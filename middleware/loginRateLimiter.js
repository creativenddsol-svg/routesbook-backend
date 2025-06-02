// server/middleware/loginRateLimiter.js
import rateLimit from "express-rate-limit";

// Rate limit: max 5 login attempts per 15 minutes
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: "Too many login attempts. Please try again later.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,
});

export default loginRateLimiter;
