// models/SeatLock.js
import mongoose from "mongoose";

const SeatLockSchema = new mongoose.Schema(
  {
    bus: { type: mongoose.Schema.Types.ObjectId, ref: "Bus", required: true },
    date: { type: String, required: true },             // YYYY-MM-DD (matches Booking)
    departureTime: { type: String, required: true },    // matches Booking
    seatNo: { type: String, required: true },           // e.g., "12" or "1A"
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lockedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },          // now + 15 min
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" }, // optional
  },
  { timestamps: true }
);

// One active lock per seat per trip
SeatLockSchema.index({ bus: 1, date: 1, departureTime: 1, seatNo: 1 }, { unique: true });

// TTL cleanup (Mongo runs this roughly every minute)
SeatLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("SeatLock", SeatLockSchema);
