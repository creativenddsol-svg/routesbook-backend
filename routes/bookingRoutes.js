// routes/bookingRoutes.js
import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
import bookingRateLimiter from "../middleware/bookingRateLimiter.js";

import {
  createBooking,
  getBookedSeats,
  getMyBookings,
  cancelBooking,
  getAllBookings,
  getSeatAvailability,
  lockSeats,
  releaseSeats,
  getLockRemaining, // ✅ NEW
} from "../controllers/bookingController.js";

const router = express.Router();

// ✅ Lock seats (PUBLIC + rate limited) — allows anonymous users to hold seats
router.post("/lock", bookingRateLimiter, lockSeats);

// ✅ Release seats (PUBLIC) — uses clientId or IP when user isn’t logged in
router.delete("/release", releaseSeats);

// ✅ Remaining time for current hold (PUBLIC) — used by FE countdown
router.get("/lock-remaining", getLockRemaining);

// ✅ Book seats (protected)
router.post("/", authMiddleware, bookingRateLimiter, createBooking);

// ✅ Get booked seats
router.get("/booked-seats", getBookedSeats);

// ✅ Get current user's bookings (protected)
router.get("/me", authMiddleware, getMyBookings);

// ✅ Cancel a booking (protected)
router.delete("/:id", authMiddleware, cancelBooking);

// ✅ Admin: All bookings (protected + admin)
router.get("/admin/bookings", authMiddleware, adminMiddleware, getAllBookings);

// ✅ Seat availability
router.get("/availability/:busId", getSeatAvailability);

export default router;
