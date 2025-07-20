import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
import {
  getActiveOperators,
  getOperatorById,
  createOperator,
  updateOperator,
  deleteOperator,
} from "../controllers/busOperatorController.js";

const router = express.Router();

// ✅ Public routes
router.get("/", getActiveOperators);
router.get("/:id", getOperatorById);

// ✅ Admin-only routes
router.post("/", authMiddleware, adminMiddleware, createOperator);
router.put("/:id", authMiddleware, adminMiddleware, updateOperator);
router.delete("/:id", authMiddleware, adminMiddleware, deleteOperator);

export default router;
