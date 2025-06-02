// server/routes/profileRoutes.js
import express from "express";
import authMiddleware from "../middleware/authMiddleware.js"; // ✅ Default import

import {
  getProfile,
  updateProfile,
  changePassword, // ✅ Import change password controller
} from "../controllers/profileController.js";

const router = express.Router();

// ✅ GET profile info - /api/profile
router.get("/", authMiddleware, getProfile);

// ✅ PUT profile update - /api/profile
router.put("/", authMiddleware, updateProfile);

// ✅ PUT change password - /api/profile/change-password
router.put("/change-password", authMiddleware, changePassword);

export default router;
