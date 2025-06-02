import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    bus: { type: mongoose.Schema.Types.ObjectId, ref: "Bus", required: true },
    date: { type: String, required: true }, // travel date
    selectedSeats: { type: [String], required: true },
    paymentStatus: { type: String, enum: ["Pending", "Paid"], default: "Paid" },
  },
  { timestamps: true }
);

export default mongoose.model("Booking", bookingSchema);
