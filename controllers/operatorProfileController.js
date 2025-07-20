import asyncHandler from "../utils/asyncHandler.js";
import User from "../models/User.js";

/**
 * @desc   Get the logged-in operator’s profile
 * @route  GET /api/operator-profile/me
 * @access Operator (protected)
 */
export const getOperatorProfile = asyncHandler(async (req, res) => {
  const operator = await User.findById(req.user._id).select(
    "fullName email operatorProfile"
  );
  res.json(operator);
});

/**
 * @desc   Update the logged-in operator’s profile
 * @route  PUT /api/operator-profile/me
 * @access Operator (protected)
 */
export const updateOperatorProfile = asyncHandler(async (req, res) => {
  // Expecting { operatorProfile: { …fields… } } in body
  const updates = { operatorProfile: req.body.operatorProfile };

  const updated = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  }).select("fullName email operatorProfile");

  res.json(updated);
});
