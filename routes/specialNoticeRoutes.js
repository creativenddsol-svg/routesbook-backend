import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
import {
  addSpecialNotice,
  updateSpecialNotice,
  deleteSpecialNotice,
  getActiveNotices,
} from "../controllers/specialNoticeController.js";

const router = express.Router();

// Public route
router.get("/", getActiveNotices);

// Admin-only routes
router.post("/", authMiddleware, adminMiddleware, addSpecialNotice);
router.put("/:id", authMiddleware, adminMiddleware, updateSpecialNotice);
router.delete("/:id", authMiddleware, adminMiddleware, deleteSpecialNotice);

export default router;
