// controllers/profileController.js
import asyncHandler from "../utils/asyncHandler.js";
import User from "../models/User.js";
import logAudit from "../utils/auditLogger.js"; // ✅ Import logAudit as default
import bcrypt from "bcryptjs";

/**
 * ✅ Get user profile
 * @route GET /api/profile
 * @access Private
 */
export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  res.json({
    id: user._id,
    name: user.name,
    email: user.email,
    nic: user.nic,
    phone: user.phone,
    profilePicture: user.profilePicture,
    role: user.role,
  });
});

/**
 * ✅ Update user profile
 * @route PUT /api/profile
 * @access Private
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const updates = {};
  const fieldsToUpdate = ["name", "nic", "phone", "profilePicture"];

  fieldsToUpdate.forEach((field) => {
    if (req.body[field] && req.body[field] !== user[field]) {
      updates[field] = {
        old: user[field] || null,
        new: req.body[field],
      };
      user[field] = req.body[field];
    }
  });

  await user.save();

  // ✅ Log audit only if there were actual changes
  if (Object.keys(updates).length > 0) {
    await logAudit(req.user.id, "PROFILE_UPDATE", updates, req.ip);
  }

  res.json({
    message: "Profile updated successfully",
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      nic: user.nic,
      phone: user.phone,
      profilePicture: user.profilePicture,
      role: user.role,
    },
  });
});

/**
 * ✅ Change user password
 * @route PUT /api/profile/change-password
 * @access Private
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error("Current password and new password are required");
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    res.status(400);
    throw new Error("Current password is incorrect");
  }

  // ✅ Update password securely
  user.password = newPassword;
  await user.save();

  // ✅ Log audit for password change
  await logAudit(req.user.id, "PASSWORD_CHANGED", {}, req.ip);

  res.json({ message: "Password changed successfully" });
});
