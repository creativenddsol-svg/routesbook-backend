import asyncHandler from "../utils/asyncHandler.js";
import User from "../models/User.js";
import logAudit from "../utils/auditLogger.js"; // ✅ correctly import the function

// @desc    Get current user profile
// @route   GET /api/profile
// @access  Private
export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  res.json(user);
});

// @desc    Update user profile (without password change)
// @route   PUT /api/profile
// @access  Private
export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Track which fields are being changed
  const changes = {};

  if (req.body.name && req.body.name !== user.name) {
    changes.name = { old: user.name, new: req.body.name };
    user.name = req.body.name;
  }

  if (req.body.email && req.body.email !== user.email) {
    changes.email = { old: user.email, new: req.body.email };
    user.email = req.body.email;
  }

  if (req.body.nic && req.body.nic !== user.nic) {
    changes.nic = { old: user.nic, new: req.body.nic };
    user.nic = req.body.nic;
  }

  if (
    req.body.profilePicture &&
    req.body.profilePicture !== user.profilePicture
  ) {
    changes.profilePicture = {
      old: user.profilePicture || null,
      new: req.body.profilePicture,
    };
    user.profilePicture = req.body.profilePicture;
  }

  // 🚫 Remove password change from here!
  // If needed, create a separate `/api/profile/change-password` endpoint.

  const updatedUser = await user.save();

  // ✅ Log audit only if something was updated
  if (Object.keys(changes).length > 0) {
    await logAudit(user._id, "PROFILE_UPDATE", changes, req.ip);
  }

  res.json({
    id: updatedUser._id,
    name: updatedUser.name,
    email: updatedUser.email,
    nic: updatedUser.nic,
    profilePicture: updatedUser.profilePicture || null,
    role: updatedUser.role,
  });
});
