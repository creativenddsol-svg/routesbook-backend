// server/controllers/seatLockController.js

import asyncHandler from "../utils/asyncHandler.js";
import SeatLock from "../models/SeatLock.js";
import Bus from "../models/Bus.js";

// ✅ Lock seats for a user
export const lockSeats = asyncHandler(async (req, res) => {
  const { busId } = req.params;
  const { date, selectedSeats } = req.body;

  if (!busId || !date || !selectedSeats || selectedSeats.length === 0) {
    res.status(400);
    throw new Error("Missing seat lock details");
  }

  // Check if bus exists
  const bus = await Bus.findById(busId);
  if (!bus) {
    res.status(404);
    throw new Error("Bus not found");
  }

  // Validate seat count (4 max at one time)
  if (selectedSeats.length > 4) {
    res.status(400);
    throw new Error("You can only select up to 4 seats at a time.");
  }

  // Clear any previous seat locks by the same user
  await SeatLock.deleteMany({ user: req.user.id, bus: busId, date });

  // Create a new seat lock (valid for 5 mins)
  const lock = await SeatLock.create({
    user: req.user.id,
    bus: busId,
    date,
    selectedSeats,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
  });

  res.status(201).json({
    message: "Seats locked successfully.",
    seatLock: lock,
  });
});
