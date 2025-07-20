// models/OperatorPayment.js
import mongoose from "mongoose";

const operatorPaymentSchema = new mongoose.Schema(
  {
    operator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    bookings: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
      },
    ],
    totalRevenue: {
      type: Number,
      required: true,
    },
    totalCommission: {
      type: Number,
      required: true,
    },
    operatorReceivable: {
      type: Number,
      required: true,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Admin user who paid
      required: true,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model("OperatorPayment", operatorPaymentSchema);
