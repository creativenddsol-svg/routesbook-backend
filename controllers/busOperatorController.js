import Bus from "../models/Bus.js";
import Booking from "../models/Booking.js";
import asyncHandler from "../utils/asyncHandler.js";

// ✅ GET /api/operator/dashboard
export const getOperatorDashboard = asyncHandler(async (req, res) => {
  const operatorId = req.user._id;

  const today = new Date().toISOString().split("T")[0];

  // Fetch buses of this operator
  const buses = await Bus.find({ operator: operatorId });

  const busIds = buses.map((bus) => bus._id);

  // Fetch today's bookings
  const bookings = await Booking.find({
    bus: { $in: busIds },
    date: today,
  });

  // Calculate total income
  const totalIncome = bookings.reduce(
    (sum, booking) => sum + booking.totalPrice,
    0
  );

  const totalSeatsBooked = bookings.reduce((sum, b) => sum + b.seats.length, 0);

  res.json({
    busCount: buses.length,
    bookingsToday: bookings.length,
    totalIncome,
    totalSeatsBooked,
  });
});
