// src/controllers/operatorDashboardController.js

import asyncHandler from "../utils/asyncHandler.js";
import Bus from "../models/Bus.js";
import Booking from "../models/Booking.js";
import { format } from "date-fns"; // date-fns should already be installed

/**
 * @desc    Get advanced dashboard statistics for a given date range.
 * @route   GET /api/operator/dashboard?startDate=...&endDate=...
 * @access  Private (Operator only)
 */
export const getOperatorDashboard = asyncHandler(async (req, res) => {
  const operatorId = req.user._id;
  // Dates are received as strings like "2025-07-10"
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    res.status(400);
    throw new Error("A start and end date are required.");
  }

  // Find all bus IDs that belong to this operator
  const operatorBuses = await Bus.find({ operator: operatorId }).select("_id");
  const busIds = operatorBuses.map((bus) => bus._id);

  let currentStats = {
    totalBookings: 0,
    totalRevenue: 0,
    latestBookings: [],
    dailyBreakdown: [],
  };

  if (busIds.length > 0) {
    // ✅ FIX: Filter by the 'date' field (the trip date), not 'createdAt'.
    const bookings = await Booking.find({
      bus: { $in: busIds },
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: "asc" });

    const totalRevenue = bookings.reduce(
      (sum, b) => sum + (b.totalAmount || 0),
      0
    );
    const totalBookings = bookings.length;

    // ✅ FIX: Group by the booking 'date' string for the chart breakdown.
    const dailyBreakdown = bookings.reduce((acc, booking) => {
      const day = booking.date; // Use the date string directly
      if (!acc[day]) {
        acc[day] = { date: day, bookings: 0, revenue: 0 };
      }
      acc[day].bookings += 1;
      acc[day].revenue += booking.totalAmount || 0;
      return acc;
    }, {});

    currentStats = {
      totalBookings,
      totalRevenue,
      latestBookings: bookings.slice(-5).reverse(),
      dailyBreakdown: Object.values(dailyBreakdown),
    };
  }

  res.json({
    totalBuses: busIds.length,
    currentStats,
  });
});
