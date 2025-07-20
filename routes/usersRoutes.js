// routes/userRoutes.js
import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import asyncHandler from "express-async-handler";

const router = express.Router();

// ✅ Get current logged-in user profile
router.get("/", authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  res.json(user);
});

// ✅ Update profile info
router.put("/", authMiddleware, async (req, res) => {
  const { name, email, nic } = req.body;

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  user.name = name || user.name;
  user.email = email || user.email;
  user.nic = nic || user.nic;

  await user.save();
  res.json({ message: "Profile updated" });
});

// ✅ Change password
router.put("/password", authMiddleware, async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id);
  const isMatch = await bcrypt.compare(oldPassword, user.password);

  if (!isMatch) {
    return res.status(400).json({ message: "Incorrect old password" });
  }

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(newPassword, salt);

  await user.save();
  res.json({ message: "Password changed successfully" });
});

// ✅ NEW: Get all operator users (admin only)
router.get(
  "/operators",
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const operators = await User.find({ role: "operator" }).select(
      "_id fullName email"
    );
    res.json(operators);
  })
);

export default router;
