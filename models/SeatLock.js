// models/SeatLock.js
import mongoose from "mongoose";

const SeatLockSchema = new mongoose.Schema(
  {
    bus: { type: mongoose.Schema.Types.ObjectId, ref: "Bus", required: true },
    date: { type: String, required: true },              // YYYY-MM-DD (matches Booking)
    departureTime: { type: String, required: true },     // matches Booking
    seatNo: { type: String, required: true },            // e.g., "12" or "1A"

    // Make user id optional to support guest/anonymous locks
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    // Canonical identity for guests or logged-in users (clientId/IP/user)
    ownerKey: { type: String, required: false, index: true },

    // Optional metadata for adjacency rules / UI
    gender: { type: String, enum: ["M", "F"], required: false },

    lockedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },           // now + 15 min

    // When a lock converts to a booking, this can be linked
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" }, // optional
  },
  { timestamps: true }
);

// One active lock per seat per trip
SeatLockSchema.index(
  { bus: 1, date: 1, departureTime: 1, seatNo: 1 },
  { unique: true }
);

// TTL cleanup (Mongo runs this roughly every minute)
SeatLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("SeatLock", SeatLockSchema);
