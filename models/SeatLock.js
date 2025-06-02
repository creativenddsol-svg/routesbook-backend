// models/SeatLock.js
import mongoose from "mongoose";

const seatLockSchema = new mongoose.Schema({
  bus: { type: mongoose.Schema.Types.ObjectId, ref: "Bus", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: String, required: true },
  selectedSeats: [{ type: String }],
  expiresAt: { type: Date, required: true }, // lock expiry
});

const SeatLock = mongoose.model("SeatLock", seatLockSchema);
export default SeatLock;
