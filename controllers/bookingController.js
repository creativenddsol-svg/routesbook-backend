import Booking from "../models/Booking.js";
import Bus from "../models/Bus.js";
import asyncHandler from "express-async-handler";
import logAudit from "../utils/auditLogger.js";
import mongoose from "mongoose";

export const createBooking = asyncHandler(async (req, res) => {
  // 1. GET ALL THE DATA FROM THE FRONTEND FLOW
  const {
    busId,
    date,
    selectedSeats,
    departureTime,
    passenger, // This is the passenger object from the frontend
    boardingPoint,
    droppingPoint,
  } = req.body;

  // 2. VALIDATE THE INCOMING DATA
  if (
    !busId ||
    !date ||
    !selectedSeats ||
    selectedSeats.length === 0 ||
    !departureTime ||
    !passenger || // Ensure passenger object exists
    !boardingPoint ||
    !droppingPoint
  ) {
    res.status(400);
    throw new Error("Missing complete booking details.");
  }

  // 3. CHECK FOR SEAT CONFLICTS
  const existingBookings = await Booking.find({
    bus: busId,
    date,
    departureTime,
    selectedSeats: { $in: selectedSeats.map(String) },
    $or: [{ paymentStatus: "Paid" }, { isManual: true }],
  });

  if (existingBookings.length > 0) {
    res.status(409);
    throw new Error("Sorry, one or more selected seats were just booked.");
  }

  // 4. FETCH BUS DETAILS FROM DATABASE FOR PRICING
  const bus = await Bus.findById(busId);
  if (!bus) {
    res.status(404);
    throw new Error("Bus not found.");
  }

  // 5. CALCULATE PRICE ON THE BACKEND, IGNORING FRONTEND PRICE
  let pricePerSeat = bus.price;

  const specificFare = bus.fares?.find(
    (f) =>
      f.boardingPoint === boardingPoint?.point &&
      f.droppingPoint === droppingPoint?.point
  );
  if (specificFare) {
    pricePerSeat = specificFare.price;
  }

  const basePrice = pricePerSeat * selectedSeats.length;
  let convenienceFee = 0;

  if (bus.convenienceFee) {
    if (bus.convenienceFee.amountType === "percentage") {
      convenienceFee = (basePrice * bus.convenienceFee.value) / 100;
    } else {
      convenienceFee = bus.convenienceFee.value * selectedSeats.length;
    }
  }

  const totalAmount = basePrice + convenienceFee;

  // 6. ✅ FIX: BUILD THE BOOKING DOCUMENT DEFENSIVELY
  const bookingData = {
    user: req.user._id,
    bus: busId,
    date,
    departureTime,
    selectedSeats: selectedSeats.map(String),
    // Use optional chaining (?.) to prevent crashes if passenger object is malformed
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

  // 7. CREATE THE BOOKING
  const booking = await Booking.create(bookingData);

  await logAudit(
    req.user._id,
    "BOOKING_CREATED",
    { busId, seats: selectedSeats, email: req.user.email, departureTime },
    req.ip
  );

  res.status(201).json({
    message: "Booking created successfully.",
    booking,
  });
});

// --- Other controller functions remain unchanged ---

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

export const getBookedSeats = asyncHandler(async (req, res) => {
  const { busId, date, departureTime } = req.query;
  if (!busId || !date || !departureTime) {
    res.status(400);
    throw new Error("Bus ID, date, and departure time are required.");
  }
  const bookings = await Booking.find({
    bus: busId,
    date: date,
    departureTime: departureTime,
    $or: [{ paymentStatus: "Paid" }, { isManual: true }],
  });
  const bookedSeats = bookings.flatMap((b) => b.selectedSeats.map(String));
  res.json({ bookedSeats });
});

export const getMyBookings = asyncHandler(async (req, res) => {
  if (!req.user?._id) {
    res.status(401);
    throw new Error("User not authenticated.");
  }
  const bookings = await Booking.find({ user: req.user._id }).populate("bus");
  res.json(bookings);
});

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
    departureTime: departureTime,
    $or: [{ paymentStatus: "Paid" }, { isManual: true }],
  });
  const bookedSeats = bookings.flatMap((b) => b.selectedSeats.map(String));
  const availableSeats = bus.seatLayout.length - bookedSeats.length;
  res.json({ availableSeats, bookedSeats });
});

export const lockSeats = asyncHandler(async (req, res) => {
  res.status(410).json({ message: "Seat locking is no longer supported." });
});
