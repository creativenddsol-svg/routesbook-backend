import express from "express";
import {
  signup,
  login,
  refreshAccessToken,
  logout,
  sendResetPasswordEmail,
  resetPassword,
} from "../controllers/authController.js";

import {
  signupValidator,
  loginValidator,
} from "../validators/authValidator.js";
import validateRequest from "../middleware/validateRequest.js";

// ✅ Import login rate limiter middleware
import loginRateLimiter from "../middleware/loginRateLimiter.js";

const router = express.Router();

// 🔐 Signup route with validation
router.post("/signup", signupValidator, validateRequest, signup);

// 🔐 Login with rate limiting, validation, and controller
router.post("/login", loginRateLimiter, loginValidator, validateRequest, login);

// 🔄 Refresh Access Token from HTTP-only cookie
router.post("/refresh", refreshAccessToken);

// 🔐 Logout (clear refresh token cookie)
router.post("/logout", logout);

// 🔐 Forgot Password - Send reset link to email
router.post("/forgot-password", sendResetPasswordEmail);

// 🔐 Reset Password - Save new password
router.post("/reset-password/:token", resetPassword);

export default router;
