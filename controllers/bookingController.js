// controllers/bookingController.js
import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Bus from "../models/Bus.js";
import SeatLock from "../models/SeatLock.js";
import logAudit from "../utils/auditLogger.js";

/* ---------------- Config ---------------- */
const LOCK_MS = 15 * 60 * 1000; // 15 minutes

/* ---------------- Helpers ---------------- */
const asSeatStrings = (arr) => (Array.isArray(arr) ? arr.map((s) => String(s)) : []);

const getClientId = (req) =>
  (req.headers["x-client-id"] && String(req.headers["x-client-id"])) ||
  (req.body && req.body.clientId) ||
  (req.query && req.query.clientId) ||
  null;

// ⚠️ IMPORTANT: force a stable owner identity (userId or clientId only)
const getOwnerKey = (req) => {
  if (req.user?._id) return String(req.user._id);
  const cid = getClientId(req);
  if (cid) return cid;
  throw new Error("Missing clientId. Include it in body/query or 'x-client-id' header.");
};

/* =========================================================
 * CREATE BOOKING (protected)
 * ======================================================= */
export const createBooking = asyncHandler(async (req, res) => {
  const {
    busId,
    date,
    departureTime,
    passenger,
    boardingPoint,
    droppingPoint,
    selectedSeats,    // legacy
    seatAllocations,  // [{ seat, gender }]
    passengers,       // [{ seat, name, age, gender }]
    clientId          // optional: link pre-login locks
  } = req.body || {};

  if (!req.user?._id) {
    res.status(401);
    throw new Error("User not authenticated.");
  }

  const fromAlloc = Array.isArray(seatAllocations)
    ? seatAllocations.map((x) => String(x.seat))
    : null;

  const effectiveSelectedSeats =
    (fromAlloc && fromAlloc.length ? fromAlloc : asSeatStrings(selectedSeats)).filter(Boolean);

  if (
    !busId ||
    !date ||
    !departureTime ||
    !passenger ||
    !boardingPoint ||
    !droppingPoint ||
    effectiveSelectedSeats.length === 0
  ) {
    res.status(400);
    throw new Error("Missing complete booking details.");
  }

  if (Array.isArray(passengers) && passengers.length) {
    const pSeats = passengers.map((p) => String(p.seat)).sort();
    const sSeats = [...effectiveSelectedSeats].sort();
    if (pSeats.join("|") !== sSeats.join("|")) {
      res.status(400);
      throw new Error("Passengers must cover every selected seat (seat mismatch).");
    }
  }
  if (Array.isArray(seatAllocations) && Array.isArray(selectedSeats)) {
    if (seatAllocations.length !== selectedSeats.length) {
      res.status(400);
      throw new Error("seatAllocations length must match selectedSeats length.");
    }
  }

  // Hard conflicts (paid/manual)
  const hardConflicts = await Booking.find({
    bus: busId,
    date,
    departureTime,
    selectedSeats: { $in: effectiveSelectedSeats },
    $or: [{ paymentStatus: "Paid" }, { isManual: true }],
  }).select("_id selectedSeats");
  if (hardConflicts.length) {
    res.status(409);
    throw new Error("Sorry, one or more selected seats were just booked.");
  }

  // Require valid locks (accept: userId OR clientId)
  const now = new Date();
  const ownerKey = getOwnerKey(req);
  const cid = clientId || getClientId(req);

  const myLocks = await SeatLock.find({
    bus: busId,
    date,
    departureTime,
    seatNo: { $in: effectiveSelectedSeats },
    expiresAt: { $gt: now },
    $or: [
      { lockedBy: req.user._id },
      { ownerKey },            // userId or clientId (stable)
      ...(cid ? [{ ownerKey: cid }] : []),
    ],
  }).select("seatNo ownerKey lockedBy expiresAt");

  if (myLocks.length !== effectiveSelectedSeats.length) {
    res.status(409);
    throw new Error("Some seats are no longer locked by you or the lock expired.");
  }

  // Pricing
  const bus = await Bus.findById(busId);
  if (!bus) {
    res.status(404);
    throw new Error("Bus not found.");
  }

  let pricePerSeat = bus.price;
  const routeFare = Array.isArray(bus.fares)
    ? bus.fares.find(
        (f) =>
          f.boardingPoint === boardingPoint?.point &&
          f.droppingPoint === droppingPoint?.point
      )
    : null;
  if (routeFare) pricePerSeat = routeFare.price;

  const basePrice = pricePerSeat * effectiveSelectedSeats.length;

  let convenienceFee = 0;
  if (bus.convenienceFee) {
    if (bus.convenienceFee.amountType === "percentage") {
      convenienceFee = (basePrice * Number(bus.convenienceFee.value || 0)) / 100;
    } else {
      convenienceFee = Number(bus.convenienceFee.value || 0) * effectiveSelectedSeats.length;
    }
  }
  const totalAmount = basePrice + convenienceFee;

  // Normalize passengers & allocations
  const normalizedPassengers =
    Array.isArray(passengers) && passengers.length
      ? passengers.map((p) => ({
          seat: String(p.seat),
          name: (p.name || "").trim(),
          age:
            typeof p.age === "number"
              ? p.age
              : p.age === "" || p.age == null
              ? undefined
              : Number(p.age),
          gender: p.gender === "F" ? "F" : "M",
        }))
      : [];

  const normalizedSeatAllocations =
    Array.isArray(seatAllocations) && seatAllocations.length
      ? seatAllocations.map((sa) => ({
          seat: String(sa.seat),
          gender: sa.gender === "F" ? "F" : "M",
        }))
      : normalizedPassengers.length
      ? normalizedPassengers.map((p) => ({ seat: p.seat, gender: p.gender }))
      : effectiveSelectedSeats.map((s) => ({ seat: String(s), gender: "M" }));

  const bookingDoc = {
    user: req.user._id,
    bus: busId,
    date,
    departureTime,
    selectedSeats: effectiveSelectedSeats,
    seatAllocations: normalizedSeatAllocations,
    passengers: normalizedPassengers,
    passengerInfo: {
      fullName: passenger?.name || "N/A",
      phone: passenger?.mobile || "N/A",
      nic: passenger?.nic || "N/A",
      email: passenger?.email || "N/A",
    },
    from: boardingPoint?.point,
    to: droppingPoint?.point,
    paymentStatus: "Paid",
    convenienceFee,
    totalAmount,
  };

  // Transaction: re-check + create + clear locks
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const conflictInTxn = await Booking.find({
      bus: busId,
      date,
      departureTime,
      selectedSeats: { $in: effectiveSelectedSeats },
      $or: [{ paymentStatus: "Paid" }, { isManual: true }],
    })
      .select("_id")
      .session(session);

    if (conflictInTxn.length) {
      throw new Error("Sorry, one or more selected seats were just booked (txn).");
    }

    const [booking] = await Booking.create([bookingDoc], { session });

    await SeatLock.deleteMany(
      {
        bus: busId,
        date,
        departureTime,
        seatNo: { $in: effectiveSelectedSeats },
        $or: [
          { lockedBy: req.user._id },
          { ownerKey },
          ...(cid ? [{ ownerKey: cid }] : []),
        ],
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    await logAudit(
      req.user._id,
      "BOOKING_CREATED",
      { busId, seats: effectiveSelectedSeats, departureTime, email: req.user.email },
      req.ip
    );

    return res.status(201).json({ message: "Booking created successfully.", booking });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});

/* =========================================================
 * CANCEL BOOKING (protected)
 * ======================================================= */
export const cancelBooking = asyncHandler(async (req, res) => {
  if (!req.user?._id) {
    res.status(401);
    throw new Error("User not authenticated.");
  }
  const booking = await Booking.findOneAndDelete({
    _id: req.params.id,
    user: req.user._id,
  });
  if (!booking) {
    res.status(404);
    throw new Error("Booking not found or unauthorized.");
  }
  await logAudit(
    req.user._id,
    "BOOKING_CANCELLED",
    { bookingId: req.params.id, email: req.user.email },
    req.ip
  );
  res.json({ message: "Booking cancelled successfully." });
});

/* =========================================================
 * GET BOOKED SEATS (paid/manual only)
 * ======================================================= */
export const getBookedSeats = asyncHandler(async (req, res) => {
  const { busId, date, departureTime } = req.query || {};
  if (!busId || !date || !departureTime) {
    res.status(400);
    throw new Error("Bus ID, date, and departure time are required.");
  }

  const bookings = await Booking.find({
    bus: busId,
    date,
    departureTime,
    $or: [{ paymentStatus: "Paid" }, { isManual: true }],
  }).select("selectedSeats seatAllocations");

  const bookedSeats = bookings.flatMap((b) => (b.selectedSeats || []).map(String));

  const seatGenderMap = {};
  bookings.forEach((b) => {
    (b.seatAllocations || []).forEach((sa) => {
      seatGenderMap[String(sa.seat)] = sa.gender === "F" ? "F" : "M";
    });
  });

  res.json({ bookedSeats, seatGenderMap });
});

/* =========================================================
 * MY BOOKINGS (protected)
 * ======================================================= */
export const getMyBookings = asyncHandler(async (req, res) => {
  if (!req.user?._id) {
    res.status(401);
    throw new Error("User not authenticated.");
  }
  const bookings = await Booking.find({ user: req.user._id }).populate("bus");
  res.json(bookings);
});

/* =========================================================
 * ADMIN: ALL BOOKINGS
 * ======================================================= */
export const getAllBookings = asyncHandler(async (req, res) => {
  const { date, from, to, userEmail } = req.query || {};
  const query = {};
  if (date) query.date = date;

  let bookings = await Booking.find(query).populate("user").populate("bus");

  if (userEmail) {
    bookings = bookings.filter((b) =>
      b.user?.email?.toLowerCase().includes(String(userEmail).toLowerCase())
    );
  }
  if (from) {
    bookings = bookings.filter((b) =>
      b.bus?.from?.toLowerCase().includes(String(from).toLowerCase())
    );
  }
  if (to) {
    bookings = bookings.filter((b) =>
      b.bus?.to?.toLowerCase().includes(String(to).toLowerCase())
    );
  }

  res.status(200).json(bookings);
});

/* =========================================================
 * SEAT AVAILABILITY (booked + active locks)
 * ======================================================= */
export const getSeatAvailability = asyncHandler(async (req, res) => {
  const { date, departureTime } = req.query || {};
  const busId = req.params.busId;

  const bus = await Bus.findById(busId);
  if (!bus) {
    res.status(404);
    throw new Error("Bus not found.");
  }

  const bookings = await Booking.find({
    bus: busId,
    date,
    departureTime,
    $or: [{ paymentStatus: "Paid" }, { isManual: true }],
  }).select("selectedSeats seatAllocations");

  const bookedSeatsPaid = bookings.flatMap((b) => (b.selectedSeats || []).map(String));

  const activeLocks = await SeatLock.find({
    bus: busId,
    date,
    departureTime,
    expiresAt: { $gt: new Date() },
  }).select("seatNo");

  const lockedSeats = activeLocks.map((l) => String(l.seatNo));
  const allBlocked = Array.from(new Set([...bookedSeatsPaid, ...lockedSeats]));
  const availableSeats = (bus.seatLayout?.length || 0) - allBlocked.length;

  const seatGenderMap = {};
  bookings.forEach((b) => {
    (b.seatAllocations || []).forEach((sa) => {
      seatGenderMap[String(sa.seat)] = sa.gender === "F" ? "F" : "M";
    });
  });

  res.json({ availableSeats, bookedSeats: allBlocked, seatGenderMap, lockedSeats });
});

/* =========================================================
 * LOCK SEATS (PUBLIC) — idempotent
 * ======================================================= */
export const lockSeats = asyncHandler(async (req, res) => {
  const {
    busId,
    date,
    departureTime,
    seats,
    seatGenders = {},
    holdMinutes,
    seatAllocations, // also accept array
  } = req.body || {};

  if (!busId || !date || !departureTime || !Array.isArray(seats) || seats.length === 0) {
    res.status(400);
    throw new Error("busId, date, departureTime and seats[] are required.");
  }

  const bus = await Bus.findById(busId).lean();
  if (!bus) {
    res.status(400);
    throw new Error("Invalid busId.");
  }

  // Normalize seats + seat gender map
  const seatsStr = asSeatStrings(seats);
  const seatGenderMap = { ...seatGenders };
  if (Array.isArray(seatAllocations) && seatAllocations.length) {
    for (const sa of seatAllocations) {
      const s = String(sa?.seat);
      if (s) seatGenderMap[s] = sa?.gender === "F" ? "F" : "M";
    }
  }

  const ttlMs = Number(holdMinutes) > 0 ? Number(holdMinutes) * 60 * 1000 : LOCK_MS;

  // Already booked?
  const conflictBooked = await Booking.findOne({
    bus: busId,
    date,
    departureTime,
    selectedSeats: { $in: seatsStr },
    $or: [{ paymentStatus: "Paid" }, { isManual: true }],
  })
    .select("selectedSeats")
    .lean();

  if (conflictBooked) {
    const taken = (conflictBooked.selectedSeats || [])
      .map(String)
      .filter((s) => seatsStr.includes(s));
    return res.status(409).json({ message: "Some seats already booked", seatsTaken: taken });
  }

  const now = Date.now();
  const ownerKey = getOwnerKey(req); // userId or clientId

  // Locked by others? (exclude my own ownerKey and my userId)
  const otherLocks = await SeatLock.find({
    bus: busId,
    date,
    departureTime,
    seatNo: { $in: seatsStr },
    expiresAt: { $gt: new Date(now) },
    $nor: [
      ...(req.user?._id ? [{ lockedBy: req.user._id }] : []),
      { ownerKey }, // exclude myself
    ],
  })
    .select("seatNo")
    .lean();

  if (otherLocks?.length) {
    const taken = [...new Set(otherLocks.map((l) => String(l.seatNo)))];
    return res.status(409).json({ message: "Some seats already locked", seatsTaken: taken });
  }

  // Upsert/extend my locks (one doc per seat)
  const expiresAt = new Date(now + ttlMs);
  const results = [];

  for (const s of seatsStr) {
    const filter = {
      bus: busId,
      date,
      departureTime,
      seatNo: s,
      $or: [
        { expiresAt: { $lte: new Date(now) } }, // expired -> free
        ...(req.user?._id ? [{ lockedBy: req.user._id }] : []),
        { ownerKey }, // same owner -> extend
      ],
    };

    try {
      const doc = await SeatLock.findOneAndUpdate(
        filter,
        {
          $set: {
            lockedAt: new Date(now),
            expiresAt,
            ownerKey,
            ...(req.user?._id ? { lockedBy: req.user._id } : {}),
            ...(seatGenderMap && seatGenderMap[s] ? { gender: seatGenderMap[s] } : {}),
          },
          $setOnInsert: { bus: busId, date, departureTime, seatNo: s },
        },
        { new: true, upsert: true }
      );
      results.push({ seatNo: s, ok: true, lock: doc });
    } catch (e) {
      results.push({ seatNo: s, ok: false, reason: "LOCKED_BY_ANOTHER_USER" });
    }
  }

  const failed = results.filter((r) => !r.ok).map((r) => r.seatNo);
  return res.status(failed.length ? 207 : 200).json({
    ok: failed.length === 0,
    locked: results.filter((r) => r.ok).map((r) => r.seatNo),
    failed,
    expiresAt,
    remainingMs: Math.max(0, expiresAt.getTime() - Date.now()),
  });
});

/* =========================================================
 * RELEASE SEATS (PUBLIC)
 * ======================================================= */
export const releaseSeats = asyncHandler(async (req, res) => {
  const { busId, date, departureTime, seats } = req.body || {};
  if (!busId || !date || !departureTime || !Array.isArray(seats) || seats.length === 0) {
    res.status(400);
    throw new Error("busId, date, departureTime and seats[] are required.");
  }

  const ownerKeyPrimary = getOwnerKey(req);     // userId or clientId (depending on auth)
  const cid = getClientId(req);                 // always include explicit clientId if present

  const result = await SeatLock.deleteMany({
    bus: busId,
    date,
    departureTime,
    seatNo: { $in: asSeatStrings(seats) },
    $or: [
      ...(req.user?._id ? [{ lockedBy: req.user._id }] : []),
      { ownerKey: ownerKeyPrimary },
      ...(cid && cid !== ownerKeyPrimary ? [{ ownerKey: cid }] : []),
    ],
  });

  res.json({ ok: true, released: result.deletedCount || 0 });
});

/* =========================================================
 * REMAINING TIME (PUBLIC)
 * ======================================================= */
export const getLockRemaining = asyncHandler(async (req, res) => {
  const { busId, date, departureTime } = req.query || {};
  if (!busId || !date || !departureTime) {
    res.status(400);
    throw new Error("busId, date, departureTime required.");
  }

  const ownerKeyPrimary = getOwnerKey(req); // userId if logged in, else clientId
  const cid = getClientId(req);

  // Optional seat filter (scope timer to specific seats if provided)
  const seatsParam = req.query?.seats;
  const seatsFilter = Array.isArray(seatsParam)
    ? asSeatStrings(seatsParam)
    : (typeof seatsParam === "string" && seatsParam.length
        ? [String(seatsParam)]
        : []);

  const q = {
    bus: busId,
    date,
    departureTime,
    expiresAt: { $gt: new Date() },
    $or: [
      ...(req.user?._id ? [{ lockedBy: req.user._id }] : []),
      { ownerKey: ownerKeyPrimary },
      ...(cid && cid !== ownerKeyPrimary ? [{ ownerKey: cid }] : []),
    ],
  };
  if (seatsFilter.length) {
    q.seatNo = { $in: seatsFilter };
  }

  const locks = await SeatLock.find(q).select("expiresAt");

  if (!locks.length) return res.json({ remainingMs: 0 });

  const soonest = locks.reduce(
    (min, l) => (l.expiresAt < min ? l.expiresAt : min),
    locks[0].expiresAt
  );
  const remainingMs = Math.max(0, new Date(soonest).getTime() - Date.now());

  res.json({ remainingMs, expiresAt: soonest });
});
