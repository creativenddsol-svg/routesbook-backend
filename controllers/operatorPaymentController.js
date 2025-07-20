import mongoose from "mongoose"; // ✅ Required for ObjectId conversion
import Booking from "../models/Booking.js";
import Bus from "../models/Bus.js";
import User from "../models/User.js";
import OperatorPayment from "../models/OperatorPayment.js";
import asyncHandler from "express-async-handler";

// ✅ Get pending payment summary per operator
export const getPendingPayments = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ paymentStatus: "Paid" }).populate(
    "bus"
  );

  const grouped = {};

  for (const booking of bookings) {
    const operatorId = booking.bus?.operator?.toString();
    if (!operatorId) continue;

    if (!grouped[operatorId]) {
      grouped[operatorId] = {
        operator: operatorId,
        operatorName: "",
        bookings: [],
        totalRevenue: 0,
        totalCommission: 0,
        operatorReceivable: 0,
      };
    }

    grouped[operatorId].bookings.push(booking._id);
    grouped[operatorId].totalRevenue += booking.totalAmount;
    grouped[operatorId].totalCommission += booking.convenienceFee;
  }

  const operatorIds = Object.keys(grouped);
  const operators = await User.find({ _id: { $in: operatorIds } });

  for (const operator of operators) {
    grouped[operator._id].operatorName = operator.name || operator.email;
    grouped[operator._id].operatorReceivable =
      grouped[operator._id].totalRevenue -
      grouped[operator._id].totalCommission;
  }

  const result = Object.values(grouped);
  res.json(result);
});

// ✅ Mark operator as paid and create OperatorPayment record
export const markOperatorPaid = asyncHandler(async (req, res) => {
  const { operatorId, bookings } = req.body;

  if (!operatorId || !Array.isArray(bookings) || bookings.length === 0) {
    res.status(400);
    throw new Error("Missing operatorId or bookings.");
  }

  const foundBookings = await Booking.find({
    _id: { $in: bookings },
    paymentStatus: "Paid",
  });

  if (foundBookings.length === 0) {
    res.status(404);
    throw new Error("No valid unpaid bookings found.");
  }

  let totalRevenue = 0;
  let totalCommission = 0;

  for (const booking of foundBookings) {
    totalRevenue += booking.totalAmount;
    totalCommission += booking.convenienceFee;

    await Booking.updateOne(
      { _id: booking._id },
      { $set: { paymentStatus: "PaidToOperator" } }
    );
  }

  const operatorReceivable = totalRevenue - totalCommission;

  const payment = await OperatorPayment.create({
    operator: new mongoose.Types.ObjectId(operatorId),
    bookings: foundBookings.map((b) => b._id),
    totalRevenue,
    totalCommission,
    operatorReceivable,
    paidBy: req.user._id,
  });

  res.status(201).json({
    message: "Operator marked as paid successfully.",
    payment,
  });
});

// ✅ Get all past payment records
export const getPaymentHistory = asyncHandler(async (req, res) => {
  const payments = await OperatorPayment.find({})
    .populate("operator", "name email")
    .populate("paidBy", "name email")
    .sort({ paymentDate: -1 });

  res.status(200).json(payments);
});
