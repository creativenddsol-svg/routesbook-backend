import rateLimit from "express-rate-limit";

// Booking Rate Limiter: max 10 bookings per 15 minutes per IP
const bookingRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: "⚠️ Too many booking attempts. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

export default bookingRateLimiter;
