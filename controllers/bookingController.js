// server/controllers/bookingController.js

import Booking from "../models/Booking.js";
import Bus from "../models/Bus.js";
import SeatLock from "../models/SeatLock.js";
import asyncHandler from "../utils/asyncHandler.js";
import logAudit from "../utils/auditLogger.js";
import mongoose from "mongoose";

// ✅ Create booking with seat lock verification and limit
export const createBooking = asyncHandler(async (req, res) => {
  const { busId, date, selectedSeats } = req.body;

  if (!busId || !date || !selectedSeats || selectedSeats.length === 0) {
    res.status(400);
    throw new Error("Missing booking details.");
  }

  if (!mongoose.Types.ObjectId.isValid(busId)) {
    res.status(400);
    throw new Error("Invalid bus ID.");
  }

  if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
    res.status(400);
    throw new Error("Invalid user ID.");
  }

  // ✅ Enforce seat limit
  if (selectedSeats.length > 4) {
    res.status(400);
    throw new Error("You can only book up to 4 seats at a time.");
  }

  // ✅ Remove expired seat locks
  await SeatLock.deleteMany({ expiresAt: { $lt: new Date() } });

  // ✅ Validate seat lock
  const seatLock = await SeatLock.findOne({
    bus: busId,
    user: req.user.id,
    date,
    selectedSeats: { $all: selectedSeats },
  });

  if (!seatLock) {
    res.status(400);
    throw new Error("No valid seat lock found. Please select seats again.");
  }

  // ✅ Double-check if seats are already booked
  const existingBookings = await Booking.find({
    bus: busId,
    date,
    selectedSeats: { $in: selectedSeats },
  });

  if (existingBookings.length > 0) {
    res.status(409);
    throw new Error("Some selected seats are already booked.");
  }

  // ✅ Create booking
  const booking = await Booking.create({
    user: req.user.id,
    bus: busId,
    date,
    selectedSeats,
    paymentStatus: "Paid",
  });

  // ✅ Remove seat lock after successful booking
  await seatLock.deleteOne();

  // ✅ Log audit
  await logAudit(
    req.user.id,
    "BOOKING_CREATED",
    { busId, seats: selectedSeats, email: req.user.email },
    req.ip
  );

  res.status(201).json(booking);
});

// ✅ Lock seats for 10 minutes (with 4-seat max limit)
export const lockSeats = asyncHandler(async (req, res) => {
  const { busId, date, selectedSeats } = req.body;

  if (!busId || !date || !selectedSeats || selectedSeats.length === 0) {
    res.status(400);
    throw new Error("Missing seat lock details.");
  }

  if (selectedSeats.length > 4) {
    res.status(400);
    throw new Error("You can only lock up to 4 seats at a time.");
  }

  // ✅ Remove expired seat locks
  await SeatLock.deleteMany({ expiresAt: { $lt: new Date() } });

  // ✅ Check for conflicting locks by others
  const conflictingLocks = await SeatLock.find({
    bus: busId,
    date,
    selectedSeats: { $in: selectedSeats },
  });

  if (conflictingLocks.length > 0) {
    res.status(409);
    throw new Error("Some seats are temporarily locked by another user.");
  }

  // ✅ Create new seat lock
  const lock = await SeatLock.create({
    bus: busId,
    user: req.user.id,
    date,
    selectedSeats,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min lock
  });

  res.json({
    message: "Seats locked successfully. Complete payment within 10 minutes.",
    lockId: lock._id,
  });
});

// ✅ Get booked seats for a bus on a specific date
export const getBookedSeats = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const bookings = await Booking.find({ bus: req.params.busId, date });
  const bookedSeats = bookings.flatMap((b) => b.selectedSeats);
  res.json({ bookedSeats });
});

// ✅ Get current user's bookings
export const getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ user: req.user.id }).populate("bus");
  res.json(bookings);
});

// ✅ Cancel a booking
export const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findOneAndDelete({
    _id: req.params.id,
    user: req.user.id,
  });

  if (!booking) {
    res.status(404);
    throw new Error("Booking not found or unauthorized.");
  }

  await logAudit(
    req.user.id,
    "BOOKING_CANCELLED",
    { bookingId: req.params.id, email: req.user.email },
    req.ip
  );

  res.json({ message: "Booking cancelled successfully." });
});

// ✅ Admin: Get all bookings with optional filters
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

// ✅ Check seat availability for a bus
export const getSeatAvailability = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const bus = await Bus.findById(req.params.busId);
  if (!bus) {
    res.status(404);
    throw new Error("Bus not found.");
  }

  const bookings = await Booking.find({ bus: req.params.busId, date });
  const bookedSeats = bookings.flatMap((b) => b.selectedSeats);
  const availableSeats = bus.seatLayout.length - bookedSeats.length;

  res.json({ availableSeats });
});
