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
  getLockRemaining, // for countdown timer
} from "../controllers/bookingController.js";

const router = express.Router();

// Locks (public; guests allowed via clientId/IP)
router.post("/lock", bookingRateLimiter, lockSeats);

// Release (support DELETE and POST for sendBeacon/keepalive fallbacks)
router.delete("/release", releaseSeats);
router.post("/release", releaseSeats);

// Remaining time (support both aliases used on FE)
router.get("/lock-remaining", getLockRemaining);
router.get("/lock/remaining", getLockRemaining);

// Booking actions
router.post("/", authMiddleware, bookingRateLimiter, createBooking);
router.get("/booked-seats", getBookedSeats);
router.get("/me", authMiddleware, getMyBookings);
router.delete("/:id", authMiddleware, cancelBooking);

// Admin
router.get("/admin/bookings", authMiddleware, adminMiddleware, getAllBookings);

// Availability (booked + active locks)
router.get("/availability/:busId", getSeatAvailability);

export default router;
