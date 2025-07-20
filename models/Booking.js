import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Manual bookings may not have a user account
    },
    bus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
    // --- ✅ [CRITICAL UPDATE] ---
    // Added departureTime to associate each booking with a specific trip.
    departureTime: {
      type: String,
      required: true,
    },
    selectedSeats: {
      type: [String],
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Manual", "PaidToOperator"],
      default: "Paid",
    },

    isManual: {
      type: Boolean,
      default: false,
    },
    bookedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    passengerInfo: {
      fullName: { type: String },
      phone: { type: String },
      nic: { type: String },
    },
    from: {
      type: String,
    },
    to: {
      type: String,
    },
    convenienceFee: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Booking", bookingSchema);
