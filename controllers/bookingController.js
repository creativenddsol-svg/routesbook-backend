// controllers/bookingController.js
import Booking from "../models/Booking.js";
import Bus from "../models/Bus.js";
import SeatLock from "../models/SeatLock.js"; // NEW
import asyncHandler from "express-async-handler";
import logAudit from "../utils/auditLogger.js";
import mongoose from "mongoose";

// 15 minutes
const LOCK_MS = 15 * 60 * 1000;

/**
 * Create booking (requires valid active seat locks by the same user)
 * Accepts:
 *  - busId, date (YYYY-MM-DD), departureTime
 *  - passenger (contact) { name, mobile, nic, email }
 *  - boardingPoint, droppingPoint
 *  - selectedSeats (legacy) OR seatAllocations [{ seat, gender }]
 *  - passengers [{ seat, name, age, gender }] (optional)
 */
export const createBooking = asyncHandler(async (req, res) => {
  const {
    busId,
    date,
    selectedSeats, // legacy support
    departureTime,
    passenger, // contact object { name, mobile, nic, email }
    boardingPoint,
    droppingPoint,
    seatAllocations, // optional [{ seat, gender }]
    passengers, // optional [{ seat, name, age, gender }]
  } = req.body;

  // Build effective selected seats
  const seatsFromAlloc = Array.isArray(seatAllocations)
    ? seatAllocations.map((s) => String(s.seat))
    : null;

  const effectiveSelectedSeats =
    seatsFromAlloc && seatsFromAlloc.length > 0
      ? seatsFromAlloc
      : Array.isArray(selectedSeats)
      ? selectedSeats.map(String)
      : [];

  // Basic validation
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

  // If both provided, lengths must match
  if (Array.isArray(seatAllocations) && Array.isArray(selectedSeats)) {
    if (seatAllocations.length !== selectedSeats.length) {
      res.status(400);
      throw new Error("seatAllocations length must match selectedSeats length.");
    }
  }

  // If passengers provided, seats must exactly match
  if (Array.isArray(passengers) && passengers.length) {
    const passengerSeats = passengers.map((p) => String(p.seat)).sort();
    const effectiveSorted = [...effectiveSelectedSeats].map(String).sort();
    if (passengerSeats.join("|") !== effectiveSorted.join("|")) {
      res.status(400);
      throw new Error("Passengers must cover every selected seat (seat mismatch).");
    }
  }

  // Initial seat conflict check (paid or manual)
  const existingBookings = await Booking.find({
    bus: busId,
    date,
    departureTime,
    selectedSeats: { $in: effectiveSelectedSeats },
    $or: [{ paymentStatus: "Paid" }, { isManual: true }],
  });
  if (existingBookings.length > 0) {
    res.status(409);
    throw new Error("Sorry, one or more selected seats were just booked.");
  }

  // Require valid active locks for *all* seats by this user
  const myActiveLocks = await SeatLock.find({
    bus: busId,
    date,
    departureTime,
    seatNo: { $in: effectiveSelectedSeats },
    lockedBy: req.user._id,
    expiresAt: { $gt: new Date() },
  });

  if (myActiveLocks.length !== effectiveSelectedSeats.length) {
    res.status(409);
    throw new Error("Some seats are no longer locked by you or the lock expired.");
  }

  // Fetch bus for pricing
  const bus = await Bus.findById(busId);
  if (!bus) {
    res.status(404);
    throw new Error("Bus not found.");
  }

  // Compute price
  let pricePerSeat = bus.price;
  const specificFare = bus.fares?.find(
    (f) =>
      f.boardingPoint === boardingPoint?.point &&
      f.droppingPoint === droppingPoint?.point
  );
  if (specificFare) {
    pricePerSeat = specificFare.price;
  }

  const basePrice = pricePerSeat * effectiveSelectedSeats.length;
  let convenienceFee = 0;
  if (bus.convenienceFee) {
    if (bus.convenienceFee.amountType === "percentage") {
      convenienceFee = (basePrice * bus.convenienceFee.value) / 100;
    } else {
      convenienceFee = bus.convenienceFee.value * effectiveSelectedSeats.length;
    }
  }
  const totalAmount = basePrice + convenienceFee;

  // Normalize passengers and seat allocations
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
      : effectiveSelectedSeats.map((seatNo) => ({
          seat: String(seatNo),
          gender: "M",
        }));

  // Build document
  const bookingData = {
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
    },
    from: boardingPoint?.point,
    to: droppingPoint?.point,
    paymentStatus: "Paid", // keep your current flow
    convenienceFee,
    totalAmount,
  };

  // Transaction: re-check conflicts, create booking, then remove locks
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // Re-check seat conflict inside the transaction window
    const conflictInTxn = await Booking.find({
      bus: busId,
      date,
      departureTime,
      selectedSeats: { $in: effectiveSelectedSeats },
      $or: [{ paymentStatus: "Paid" }, { isManual: true }],
    }).session(session);

    if (conflictInTxn.length > 0) {
      throw new Error("Sorry, one or more selected seats were just booked (txn).");
    }

    // Create booking
    const [booking] = await Booking.create([bookingData], { session });

    // Remove my locks for these seats
    await SeatLock.deleteMany(
      {
        bus: busId,
        date,
        departureTime,
        seatNo: { $in: effectiveSelectedSeats },
        lockedBy: req.user._id,
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // Audit after commit
    await logAudit(
      req.user._id,
      "BOOKING_CREATED",
      {
        busId,
        seats: effectiveSelectedSeats,
        email: req.user.email,
        departureTime,
      },
      req.ip
    );

    return res.status(201).json({ message: "Booking created successfully.", booking });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});

/**
 * Cancel booking (user-owned)
 */
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

/**
 * Get booked seats (for a specific bus/date/time)
 * Returns:
 *  - bookedSeats: [ "A1", ... ]   (paid/manual only)
 *  - seatGenderMap: { "A1": "M" | "F", ... }
 */
export const getBookedSeats = asyncHandler(async (req, res) => {
  const { busId, date, departureTime } = req.query;
  if (!busId || !date || !departureTime) {
    res.status(400);
    throw new Error("Bus ID, date, and departure time are required.");
  }

  const bookings = await Booking.find({
    bus: busId,
    date,
    departureTime,
    $or: [{ paymentStatus: "Paid" }, { isManual: true }],
  });

  const bookedSeats = bookings.flatMap((b) => b.selectedSeats.map(String));

  const seatGenderMap = {};
  bookings.forEach((b) => {
    (b.seatAllocations || []).forEach((sa) => {
      seatGenderMap[String(sa.seat)] = sa.gender === "F" ? "F" : "M";
    });
  });

  res.json({ bookedSeats, seatGenderMap });
});

/**
 * Get my bookings
 */
export const getMyBookings = asyncHandler(async (req, res) => {
  if (!req.user?._id) {
    res.status(401);
    throw new Error("User not authenticated.");
  }
  const bookings = await Booking.find({ user: req.user._id }).populate("bus");
  res.json(bookings);
});

/**
 * Admin/staff: get all bookings with optional filters
 */
export const getAllBookings = asyncHandler(async (req, res) => {
  const { date, from, to, userEmail } = req.query;
  let query = {};
  if (date) query.date = date;

  let bookings = await Booking.find(query).populate("user").populate("bus");

  if (userEmail) {
    bookings = bookings.filter((b) =>
      b.user?.email?.toLowerCase().includes(userEmail.toLowerCase())
    );
  }
  if (from) {
    bookings = bookings.filter((b) =>
      b.bus?.from?.toLowerCase().includes(from.toLowerCase())
    );
  }
  if (to) {
    bookings = bookings.filter((b) =>
      b.bus?.to?.toLowerCase().includes(to.toLowerCase())
    );
  }

  res.status(200).json(bookings);
});

/**
 * Seat availability for a given bus/date/time
 * Returns:
 *  - availableSeats
 *  - bookedSeats (includes active locks)
 *  - seatGenderMap
 *  - lockedSeats (optional: for UI badges)
 */
export const getSeatAvailability = asyncHandler(async (req, res) => {
  const { date, departureTime } = req.query;

  const bus = await Bus.findById(req.params.busId);
  if (!bus) {
    res.status(404);
    throw new Error("Bus not found.");
  }

  // Paid/manual bookings
  const bookings = await Booking.find({
    bus: req.params.busId,
    date,
    departureTime,
    $or: [{ paymentStatus: "Paid" }, { isManual: true }],
  });

  const bookedSeatsPaidOrManual = bookings.flatMap((b) => b.selectedSeats.map(String));

  // Active locks
  const activeLocks = await SeatLock.find({
    bus: req.params.busId,
    date,
    departureTime,
    expiresAt: { $gt: new Date() },
  }).select("seatNo");
  const lockedSeats = activeLocks.map((l) => String(l.seatNo));

  const bookedSeats = Array.from(new Set([...bookedSeatsPaidOrManual, ...lockedSeats]));
  const availableSeats = (bus.seatLayout?.length || 0) - bookedSeats.length;

  const seatGenderMap = {};
  bookings.forEach((b) => {
    (b.seatAllocations || []).forEach((sa) => {
      seatGenderMap[String(sa.seat)] = sa.gender === "F" ? "F" : "M";
    });
  });

  res.json({ availableSeats, bookedSeats, seatGenderMap, lockedSeats });
});

/**
 * Lock seats for 15 minutes (idempotent for same user; upserts and extends)
 * POST /bookings/lock
 * body: { busId, date, departureTime, seats: [ "12", ... ] }
 */
export const lockSeats = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { busId, date, departureTime, seats } = req.body;

  if (!userId || !busId || !date || !departureTime || !Array.isArray(seats) || seats.length === 0) {
    res.status(400);
    throw new Error("busId, date, departureTime and seats[] are required.");
  }

  const now = Date.now();
  const expiresAt = new Date(now + LOCK_MS);
  const results = [];

  for (const raw of seats) {
    const seatNo = String(raw);
    const filter = {
      bus: busId,
      date,
      departureTime,
      seatNo,
      $or: [
        { expiresAt: { $lte: new Date(now) } }, // expired -> free
        { lockedBy: userId }, // already mine -> extend
      ],
    };

    try {
      const doc = await SeatLock.findOneAndUpdate(
        filter,
        {
          $set: { lockedBy: userId, lockedAt: new Date(now), expiresAt },
          $setOnInsert: { bus: busId, date, departureTime, seatNo },
        },
        { new: true, upsert: true }
      );
      results.push({ seatNo, ok: true, lock: doc });
    } catch (e) {
      // unique index violation (someone else holds it)
      results.push({ seatNo, ok: false, reason: "LOCKED_BY_ANOTHER_USER" });
    }
  }

  const failed = results.filter((r) => !r.ok);
  res.status(failed.length ? 207 : 200).json({
    ok: failed.length === 0,
    results,
    expiresAt,
    lockDurationMs: LOCK_MS,
  });
});

/**
 * Release seats held by the current user
 * DELETE /bookings/release
 * body: { busId, date, departureTime, seats: [ "12", ... ] }
 */
export const releaseSeats = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { busId, date, departureTime, seats } = req.body;

  if (!userId || !busId || !date || !departureTime || !Array.isArray(seats) || seats.length === 0) {
    res.status(400);
    throw new Error("busId, date, departureTime and seats[] are required.");
  }

  const r = await SeatLock.deleteMany({
    bus: busId,
    date,
    departureTime,
    seatNo: { $in: seats.map(String) },
    lockedBy: userId,
  });

  res.json({ ok: true, released: r.deletedCount });
});
