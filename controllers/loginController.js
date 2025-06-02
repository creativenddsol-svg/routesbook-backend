import asyncHandler from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/generateToken.js";
import logger from "../utils/logger.js"; // ✅ Winston logger

// @desc    Login user with JWT access + refresh token
// @route   POST /api/auth/login
// @access  Public
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Check if user exists
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    logger.warn(`🚫 Failed login attempt for ${email}`);
    res.status(401);
    throw new Error("Invalid email or password");
  }

  // Create payload
  const payload = { id: user._id, role: user.role };

  // Generate tokens
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // ✅ Store refresh token in HTTP-only cookie
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  // ✅ Audit log login
  logger.info(`✅ User logged in: ${user.email} (${user._id})`);

  // ✅ Send response with access token
  res.json({
    accessToken,
    user: {
      id: user._id,
      name: user.name,
      role: user.role,
    },
  });
});
