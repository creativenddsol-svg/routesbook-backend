import Booking from "../models/Booking.js";
import Bus from "../models/Bus.js";
import asyncHandler from "../utils/asyncHandler.js";
import logAudit from "../utils/auditLogger.js";
import mongoose from "mongoose";

// GET /api/operator/bookings/booked-seats
export const getOperatorBookedSeats = asyncHandler(async (req, res) => {
  const { busId, date, departureTime } = req.query;

  if (!busId || !date || !departureTime) {
    res.status(400);
    throw new Error("Bus ID, date, and departure time are required.");
  }

  if (!mongoose.Types.ObjectId.isValid(busId)) {
    res.status(400);
    throw new Error("Invalid bus ID.");
  }

  // Verify the bus belongs to the logged-in operator
  const bus = await Bus.findOne({ _id: busId, operator: req.user._id });
  if (!bus) {
    res.status(403);
    throw new Error("Unauthorized access to bus.");
  }

  // Find bookings matching the specific trip time
  const bookings = await Booking.find({ bus: busId, date, departureTime });
  const bookedSeats = bookings.flatMap((b) => b.selectedSeats);

  res.json({ bookedSeats });
});

// POST /api/operator/bookings/manual
export const createManualBooking = asyncHandler(async (req, res) => {
  const { busId, date, selectedSeats, passengerInfo, from, to, departureTime } =
    req.body;

  if (
    !busId ||
    !date ||
    !selectedSeats ||
    !departureTime ||
    selectedSeats.length === 0
  ) {
    res.status(400);
    throw new Error("Missing booking details, including departure time.");
  }

  if (!mongoose.Types.ObjectId.isValid(busId)) {
    res.status(400);
    throw new Error("Invalid bus ID.");
  }

  // Verify operator owns this bus
  const bus = await Bus.findOne({ _id: busId, operator: req.user._id });
  if (!bus) {
    res.status(403);
    throw new Error("You are not authorized to book for this bus.");
  }

  // Check for conflicts on the specific trip
  const existingBookings = await Booking.find({
    bus: busId,
    date,
    departureTime: departureTime,
    selectedSeats: { $in: selectedSeats },
  });

  if (existingBookings.length > 0) {
    res.status(409);
    throw new Error(
      "One or more selected seats are already booked for this specific trip."
    );
  }

  // ✅ FIX: Calculate the total amount using the bus price
  const totalAmount = bus.price * selectedSeats.length;

  const booking = await Booking.create({
    user: null, // No account
    bus: busId,
    date,
    departureTime: departureTime,
    selectedSeats,
    from,
    to,
    passengerInfo,
    paymentStatus: "Manual",
    isManual: true,
    bookedBy: req.user._id,
    totalAmount: totalAmount, // ✅ FIX: Add the calculated amount to the new booking document
  });

  // Log audit for operator
  await logAudit(
    req.user._id,
    "MANUAL_BOOKING_CREATED",
    {
      busId,
      seats: selectedSeats,
      operatorEmail: req.user.email,
      manual: true,
      departureTime: departureTime,
    },
    req.ip
  );

  res.status(201).json({ success: true, booking });
});
