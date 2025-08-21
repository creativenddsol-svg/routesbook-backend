// routes/noticeRoutes.js
import express from "express";
import {
  createNotice,
  getAllNotices,
  getActiveNotices,
  deleteNotice,
} from "../controllers/noticeController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";

const router = express.Router();

/* ───────── Admin-only ───────── */
router.post("/", authMiddleware, adminMiddleware, createNotice); // add
router.get("/", authMiddleware, adminMiddleware, getAllNotices); // list (admin)
router.delete("/:id", authMiddleware, adminMiddleware, deleteNotice); // delete

/* ───────── Public ───────── */
router.get("/active", getActiveNotices); // list only active for frontend

export default router;
