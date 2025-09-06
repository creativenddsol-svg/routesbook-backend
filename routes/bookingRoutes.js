// routes/bookingRoutes.js
import express from "express";
import authMiddleware from "../middleware/authMiddleware.js"; // ✅ fixed
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
  releaseSeats, // ✅ NEW
} from "../controllers/bookingController.js";

const router = express.Router();

// ✅ Lock seats (optional or disabled)
router.post("/lock", authMiddleware, lockSeats);

// ✅ Release seats (user-held locks)
router.delete("/release", authMiddleware, releaseSeats);

// ✅ Book seats
router.post("/", authMiddleware, bookingRateLimiter, createBooking);

// ✅ Get booked seats
router.get("/booked-seats", getBookedSeats);

// ✅ Get current user's bookings
router.get("/me", authMiddleware, getMyBookings);

// ✅ Cancel a booking
router.delete("/:id", authMiddleware, cancelBooking);

// ✅ Admin: All bookings
router.get("/admin/bookings", authMiddleware, adminMiddleware, getAllBookings);

// ✅ Seat availability
router.get("/availability/:busId", getSeatAvailability);

export default router;
