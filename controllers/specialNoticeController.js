import SpecialNotice from "../models/SpecialNotice.js";
import asyncHandler from "../utils/asyncHandler.js"; // Consistent with your busController

// @desc    Create a new special notice (admin only)
// @route   POST /api/special-notices
export const addSpecialNotice = asyncHandler(async (req, res) => {
  const newNotice = await SpecialNotice.create(req.body);
  res.status(201).json(newNotice);
});

// @desc    Update a special notice by ID (admin only)
// @route   PUT /api/special-notices/:id
export const updateSpecialNotice = asyncHandler(async (req, res) => {
  const updatedNotice = await SpecialNotice.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  if (!updatedNotice) {
    res.status(404);
    throw new Error("Special notice not found");
  }

  res.json(updatedNotice);
});

// @desc    Delete a special notice by ID (admin only)
// @route   DELETE /api/special-notices/:id
export const deleteSpecialNotice = asyncHandler(async (req, res) => {
  const deletedNotice = await SpecialNotice.findByIdAndDelete(req.params.id);

  if (!deletedNotice) {
    res.status(404);
    throw new Error("Special notice not found");
  }

  res.json({ message: "Special notice deleted successfully" });
});

// @desc    Get all active special notices (public)
// @route   GET /api/special-notices
export const getActiveNotices = asyncHandler(async (req, res) => {
  const notices = await SpecialNotice.find({ isActive: true }).sort({
    sortOrder: "asc",
  });
  res.json(notices);
});
