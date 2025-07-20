import asyncHandler from "../utils/asyncHandler.js";
import User from "../models/User.js";
import logAudit from "../utils/auditLogger.js";
import bcrypt from "bcryptjs";

/**
 * Get user profile
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
    fullName: user.fullName,
    email: user.email,
    nic: user.nic,
    phone: user.mobile, // return `mobile` as `phone` for frontend
    profilePicture: user.profilePicture,
    role: user.role,
  });
});

/**
 * Update user profile
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
  const fieldsToUpdate = [
    "fullName",
    "email",
    "nic",
    "mobile",
    "profilePicture",
  ];

  fieldsToUpdate.forEach((field) => {
    const bodyValue =
      field === "fullName" && req.body.name
        ? req.body.name
        : field === "mobile" && req.body.phone
        ? req.body.phone
        : req.body[field];

    if (bodyValue && bodyValue !== user[field]) {
      updates[field] = {
        old: user[field] || null,
        new: bodyValue,
      };
      user[field] = bodyValue;
    }
  });

  await user.save();

  if (Object.keys(updates).length > 0) {
    await logAudit(req.user.id, "PROFILE_UPDATE", updates, req.ip);
  }

  res.json({
    message: "Profile updated successfully",
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      nic: user.nic,
      phone: user.mobile, // again, return as `phone`
      profilePicture: user.profilePicture,
      role: user.role,
    },
  });
});

/**
 * Change user password
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

  user.password = newPassword;
  await user.save();

  await logAudit(req.user.id, "PASSWORD_CHANGED", {}, req.ip);

  res.json({ message: "Password changed successfully" });
});
