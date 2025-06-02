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
  lockSeats, // ✅ new import for seat locking
} from "../controllers/bookingController.js";

const router = express.Router();

// ✅ Lock seats before payment - /api/bookings/lock
router.post("/lock", authMiddleware, lockSeats);

// ✅ Book seats (after payment) - /api/bookings
router.post("/", authMiddleware, bookingRateLimiter, createBooking);

// ✅ Get booked seats for a specific bus on a date
router.get("/bus/:busId/seats", getBookedSeats);

// ✅ Get current user's bookings
router.get("/me", authMiddleware, getMyBookings);

// ✅ Cancel a booking
router.delete("/:id", authMiddleware, cancelBooking);

// ✅ Admin - get all bookings (with filters)
router.get("/admin/bookings", authMiddleware, adminMiddleware, getAllBookings);

// ✅ Check seat availability
router.get("/availability/:busId", getSeatAvailability);

export default router;
