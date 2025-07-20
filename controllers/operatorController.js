import asyncHandler from "express-async-handler";
import Bus from "../models/Bus.js";
import Booking from "../models/Booking.js";
import { formatISO, startOfDay, endOfDay } from "date-fns";

/**
 * @desc    Get advanced dashboard statistics for a given date range.
 * @route   GET /api/operator/dashboard?startDate=...&endDate=...
 * @access  Private (Operator only)
 */
export const getOperatorDashboard = asyncHandler(async (req, res) => {
  const operatorId = req.user._id;
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
    // Correctly filter by the 'date' field (the trip date), not 'createdAt'
    const bookings = await Booking.find({
      bus: { $in: busIds },
      date: { $gte: startDate, $lte: endDate },
    }).sort({ createdAt: "desc" }); // Sort by creation date to get latest

    const totalRevenue = bookings.reduce(
      (sum, b) => sum + (b.totalAmount || 0),
      0
    );
    const totalBookings = bookings.length;

    // Group bookings by day for the chart
    const dailyBreakdown = bookings.reduce((acc, booking) => {
      const day = booking.date; // Group by the string date
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
      latestBookings: bookings.slice(0, 5), // Get the 5 most recently created bookings
      dailyBreakdown: Object.values(dailyBreakdown).sort((a, b) =>
        a.date.localeCompare(b.date)
      ), // Sort breakdown by date
    };
  }

  // Construct the operator profile object
  const operatorProfile = {
    fullName: req.user.fullName,
    email: req.user.email,
    mobile: req.user.mobile,
    nic: req.user.nic,
    profilePicture: req.user.profilePicture,
    role: req.user.role,
  };

  res.json({
    operatorProfile,
    totalBuses: busIds.length,
    currentStats, // Send the stats nested in an object
  });
});
