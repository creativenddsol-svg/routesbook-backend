import asyncHandler from "express-async-handler";
import User from "../models/User.js";

/**
 * @route   POST /api/admin/operators/register
 * @desc    Admin – create a new operator account (or upgrade existing user)
 * @access  Private / Admin
 *
 * Expects JSON body:
 * {
 *   "fullName": "Star Travels Owner",
 *   "email":    "owner@startravels.lk",
 *   "password": "Temp123!",          // required only if user doesn't exist
 *   "mobile":   "0772223333",
 *   "nic":      "202345678V",
 *   "operatorProfile": {             // optional: initial profile info
 *     "businessName": "Star Travels"
 *   }
 * }
 */
export const registerOperator = asyncHandler(async (req, res) => {
  const {
    fullName,
    email,
    password,
    mobile,
    nic,
    operatorProfile = {},
  } = req.body;

  if (!email || !fullName) {
    res.status(400);
    throw new Error("fullName and email are required");
  }

  // Check if a user with this email already exists
  let user = await User.findOne({ email });

  if (user) {
    // If user exists but isn't an operator, upgrade role
    if (user.role !== "operator") {
      user.role = "operator";
      user.fullName = fullName; // allow admin to correct name
      user.mobile = mobile || user.mobile;
      user.nic = nic || user.nic;
      user.operatorProfile = {
        ...user.operatorProfile,
        ...operatorProfile,
      };
      await user.save();
    } else {
      res.status(400);
      throw new Error("User already an operator");
    }
  } else {
    // Create brand-new operator user
    if (!password) {
      res.status(400);
      throw new Error("Password is required for new operator account");
    }

    user = await User.create({
      fullName,
      email,
      password,
      mobile,
      nic,
      role: "operator",
      operatorProfile: {
        contactNumber: mobile,
        ...operatorProfile,
        payoutMethod: {
          bankName: "",
          accountNumber: "",
          accountHolder: "",
          payoutFrequency: "monthly",
          ...(operatorProfile.payoutMethod || {}),
        },
      },
    });
  }

  res.status(201).json({
    message: "Operator registered / updated successfully",
    operator: {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    },
  });
});
