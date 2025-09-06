// controllers/bookingController.js
import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Bus from "../models/Bus.js";
import SeatLock from "../models/SeatLock.js";
import logAudit from "../utils/auditLogger.js";

// --- Config ---
const LOCK_MS = 15 * 60 * 1000; // 15 minutes default

// Small helpers
const asSeatStrings = (arr) => (Array.isArray(arr) ? arr.map((s) => String(s)) : []);

// Resolve a stable "owner" for seat locks:
//  1) authenticated user id
//  2) X-Lock-Id header (frontend stores in localStorage)
//  3) clientId provided in body/query (fallback)
//  4) client IP (last resort)
const getLockOwner = (req) => {
  if (req.user?._id) return String(req.user._id);
  const hdr = req.headers["x-lock-id"];
  if (hdr && typeof hdr === "string" && hdr.trim()) return hdr.trim();
  const fromBody = req.body?.clientId || req.query?.clientId;
  if (fromBody && typeof fromBody === "string" && fromBody.trim()) return fromBody.trim();
  const xff = req.headers["x-forwarded-for"];
  if (xff) return xff.split(",")[0].trim();
  return req.ip || "unknown";
};

/* =========================================================
 * CREATE BOOKING  (protected)
 * Body:
 * - busId, date (YYYY-MM-DD), departureTime
 * - passenger { name, mobile, nic, email }
 * - boardingPoint, droppingPoint
 * - selectedSeats []  OR  seatAllocations [{ seat, gender }]
 * - passengers [{ seat, name, age, gender }] (optional)
 * - clientId (optional: if locks were created before login)
 * ======================================================= */
export const createBooking = asyncHandler(async (req, res) => {
  const {
    busId,
    date,
    departureTime,
    passenger,
    boardingPoint,
    droppingPoint,
    selectedSeats,     // legacy
    seatAllocations,   // [{ seat, gender }]
    passengers,        // [{ seat, name, age, gender }]
    clientId,          // to link pre-login locks
  } = req.body || {};

  if (!req.user?._id) {
    res.status(401);
    throw new Error("User not authenticated.");
  }

  // Effective seats to book
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

  // Optional consistency checks
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

  // Hard conflict (already booked/paid or manual)
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

  // Must have an active lock for ALL seats held by this user OR by the previous client id/header
  const now = new Date();
  const ownerFromHeader = req.headers["x-lock-id"];
  const userId = String(req.user._id);

  const myLocks = await SeatLock.find({
    bus: busId,
    date,
    departureTime,
    seatNo: { $in: effectiveSelectedSeats },
    expiresAt: { $gt: now },
    $or: [
      { lockedBy: req.user._id },                 // if schema stores user
      { ownerKey: userId },                       // or generic ownerKey = userId
      ...(ownerFromHeader ? [{ ownerKey: String(ownerFromHeader) }] : []),
      ...(clientId ? [{ ownerKey: String(clientId) }] : []), // allow pre-login locks
    ],
  }).select("seatNo ownerKey lockedBy expiresAt");

  if (myLocks.length !== effectiveSelectedSeats.length) {
    res.status(409);
    throw new Error("Some seats are no longer locked by you or the lock expired.");
  }

  // Load bus for pricing
  const bus = await Bus.findById(busId);
  if (!bus) {
    res.status(404);
    throw new Error("Bus not found.");
  }

  // Compute price
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

  // Normalize passengers & seat allocations
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

  // Booking doc
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
    paymentStatus: "Paid", // keep your current flow
    convenienceFee,
    totalAmount,
  };

  // Transaction: recheck, create, clear locks
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

    // Clear any locks for these seats by this user/client
    await SeatLock.deleteMany(
      {
        bus: busId,
        date,
        departureTime,
        seatNo: { $in: effectiveSelectedSeats },
        $or: [
          { lockedBy: req.user._id },
          { ownerKey: userId },
          ...(ownerFromHeader ? [{ ownerKey: String(ownerFromHeader) }] : []),
          ...(clientId ? [{ ownerKey: String(clientId) }] : []),
        ],
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // Audit
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
 * GET BOOKED SEATS  (paid/manual only)
 * Query: busId, date, departureTime
 * Returns: { bookedSeats, seatGenderMap }
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
 * ADMIN: ALL BOOKINGS (optional filters)
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
 * Route: GET /bookings/availability/:busId?date=YYYY-MM-DD&departureTime=HH:mm
 * Returns: { availableSeats, bookedSeats, seatGenderMap, lockedSeats }
 * ======================================================= */
export const getSeatAvailability = asyncHandler(async (req, res) => {
  const { date, departureTime } = req.query || {};
  const busId = req.params.busId;

  const bus = await Bus.findById(busId);
  if (!bus) {
    res.status(404);
    throw new Error("Bus not found.");
  }

  // Paid/manual bookings
  const bookings = await Booking.find({
    bus: busId,
    date,
    departureTime,
    $or: [{ paymentStatus: "Paid" }, { isManual: true }],
  }).select("selectedSeats seatAllocations");

  const bookedSeatsPaid = bookings.flatMap((b) => (b.selectedSeats || []).map(String));

  // Active locks
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
 * LOCK SEATS (PUBLIC) — idempotent for same owner; per-seat docs
 * Body: { busId, date, departureTime, seats: ["7","8"], seatGenders?, clientId?, holdMinutes? }
 * Returns 200 if all locked; 207 with {failed} if any failed (no 401/409 for UX)
 * ======================================================= */
export const lockSeats = asyncHandler(async (req, res) => {
  const {
    busId,
    date,
    departureTime,
    seats,
    seatGenders = {},
    holdMinutes,
  } = req.body || {};

  if (!busId || !date || !departureTime || !Array.isArray(seats) || seats.length === 0) {
    res.status(400);
    throw new Error("busId, date, departureTime and seats[] are required.");
  }

  // Ensure bus exists (optional)
  const bus = await Bus.findById(busId).lean();
  if (!bus) {
    res.status(400);
    throw new Error("Invalid busId.");
  }

  const seatsStr = asSeatStrings(seats);
  const ttlMs = Number(holdMinutes) > 0 ? Number(holdMinutes) * 60 * 1000 : LOCK_MS;

  // If already booked/paid, mark as failed (return 207 for consistent UI)
  const conflictBooked = await Booking.findOne({
    bus: busId,
    date,
    departureTime,
    selectedSeats: { $in: seatsStr },
    $or: [{ paymentStatus: "Paid" }, { isManual: true }],
  })
    .select("selectedSeats")
    .lean();

  const failedBooked = conflictBooked
    ? (conflictBooked.selectedSeats || []).map(String).filter((s) => seatsStr.includes(s))
    : [];

  // Seats locked by others?
  const now = Date.now();
  const ownerKey = getLockOwner(req);
  const otherLocks = await SeatLock.find({
    bus: busId,
    date,
    departureTime,
    seatNo: { $in: seatsStr },
    expiresAt: { $gt: new Date(now) },
    $nor: [
      ...(req.user?._id ? [{ lockedBy: req.user._id }] : []),
      { ownerKey },
    ],
  })
    .select("seatNo")
    .lean();

  const failedLocked = otherLocks?.length ? [...new Set(otherLocks.map((l) => String(l.seatNo)))] : [];
  const initiallyFailed = [...new Set([...failedBooked, ...failedLocked])];

  const expiresAt = new Date(now + ttlMs);
  const results = [];

  // Lock the ones that are not failed
  for (const s of seatsStr) {
    if (initiallyFailed.includes(s)) {
      results.push({ seatNo: s, ok: false, reason: "UNAVAILABLE" });
      continue;
    }
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
            ...(seatGenders && seatGenders[s] ? { gender: seatGenders[s] } : {}),
          },
          $setOnInsert: { bus: busId, date, departureTime, seatNo: s },
        },
        { new: true, upsert: true }
      );
      results.push({ seatNo: s, ok: true, lock: doc });
    } catch {
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
 * Body: { busId, date, departureTime, seats: ["7","8"], clientId? }
 * ======================================================= */
export const releaseSeats = asyncHandler(async (req, res) => {
  // axios sends DELETE body as req.body
  const { busId, date, departureTime, seats } = req.body || {};
  if (!busId || !date || !departureTime || !Array.isArray(seats) || seats.length === 0) {
    res.status(400);
    throw new Error("busId, date, departureTime and seats[] are required.");
  }

  const ownerKey = getLockOwner(req);

  const result = await SeatLock.deleteMany({
    bus: busId,
    date,
    departureTime,
    seatNo: { $in: asSeatStrings(seats) },
    $or: [
      ...(req.user?._id ? [{ lockedBy: req.user._id }] : []),
      { ownerKey },
    ],
  });

  res.json({ ok: true, released: result.deletedCount || 0 });
});

/* =========================================================
 * REMAINING TIME (PUBLIC, for countdown)
 * Query: busId, date, departureTime, clientId?
 * Returns: { remainingMs, expiresAt }
 * ======================================================= */
export const getLockRemaining = asyncHandler(async (req, res) => {
  const { busId, date, departureTime } = req.query || {};
  if (!busId || !date || !departureTime) {
    res.status(400);
    throw new Error("busId, date, departureTime required.");
  }

  const ownerKey = getLockOwner(req);

  // Find any lock by this owner for this trip; use the earliest expiry
  const locks = await SeatLock.find({
    bus: busId,
    date,
    departureTime,
    expiresAt: { $gt: new Date() },
    $or: [
      ...(req.user?._id ? [{ lockedBy: req.user._id }] : []),
      { ownerKey },
    ],
  }).select("expiresAt");

  if (!locks.length) return res.json({ remainingMs: 0 });

  const soonest = locks.reduce(
    (min, l) => (l.expiresAt < min ? l.expiresAt : min),
    locks[0].expiresAt
  );
  const remainingMs = Math.max(0, new Date(soonest).getTime() - Date.now());

  res.json({ remainingMs, expiresAt: soonest });
});
