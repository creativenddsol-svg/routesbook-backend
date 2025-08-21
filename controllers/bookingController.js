import Booking from "../models/Booking.js";
import Bus from "../models/Bus.js";
import asyncHandler from "express-async-handler";
import logAudit from "../utils/auditLogger.js";
import mongoose from "mongoose";

/**
 * Create booking
 * - Accepts:
 *    busId, date, departureTime, passenger (contact), boardingPoint, droppingPoint
 *    selectedSeats (legacy)
 *    seatAllocations: [{ seat, gender }]
 *    passengers: [{ seat, name, age, gender }]
 * - Persists:
 *    selectedSeats, seatAllocations, passengers, passengerInfo, from/to, fees/total
 * - Validates:
 *    seat conflicts, seat lists match, basic payload completeness
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
      throw new Error(
        "seatAllocations length must match selectedSeats length."
      );
    }
  }

  // If passengers provided, seats must exactly match
  if (Array.isArray(passengers) && passengers.length) {
    const passengerSeats = passengers.map((p) => String(p.seat)).sort();
    const effectiveSorted = [...effectiveSelectedSeats].map(String).sort();
    if (passengerSeats.join("|") !== effectiveSorted.join("|")) {
      res.status(400);
      throw new Error(
        "Passengers must cover every selected seat (seat mismatch)."
      );
    }
  }

  // Seat conflict check (paid or manual)
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
    passengers: normalizedPassengers, // NEW
    passengerInfo: {
      fullName: passenger?.name || "N/A",
      phone: passenger?.mobile || "N/A",
      nic: passenger?.nic || "N/A",
    },
    from: boardingPoint?.point,
    to: droppingPoint?.point,
    paymentStatus: "Paid",
    convenienceFee,
    totalAmount,
  };

  const booking = await Booking.create(bookingData);

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

  res.status(201).json({ message: "Booking created successfully.", booking });
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
 *  - bookedSeats: [ "A1", ... ]
 *  - seatGenderMap: { "A1": "M" | "F", ... }  (for coloring / rules)
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
 *  - bookedSeats
 *  - seatGenderMap
 */
export const getSeatAvailability = asyncHandler(async (req, res) => {
  const { date, departureTime } = req.query;

  const bus = await Bus.findById(req.params.busId);
  if (!bus) {
    res.status(404);
    throw new Error("Bus not found.");
  }

  const bookings = await Booking.find({
    bus: req.params.busId,
    date,
    departureTime,
    $or: [{ paymentStatus: "Paid" }, { isManual: true }],
  });

  const bookedSeats = bookings.flatMap((b) => b.selectedSeats.map(String));
  const availableSeats = (bus.seatLayout?.length || 0) - bookedSeats.length;

  const seatGenderMap = {};
  bookings.forEach((b) => {
    (b.seatAllocations || []).forEach((sa) => {
      seatGenderMap[String(sa.seat)] = sa.gender === "F" ? "F" : "M";
    });
  });

  res.json({ availableSeats, bookedSeats, seatGenderMap });
});

/**
 * Legacy: seat locking not supported
 */
export const lockSeats = asyncHandler(async (req, res) => {
  res.status(410).json({ message: "Seat locking is no longer supported." });
});
