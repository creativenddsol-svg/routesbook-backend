// server/routes/promotionRoutes.js
import express from "express";
import {
  getActivePromotions,
  createPromotion,
  getAllPromotionsAdmin,
  getPromotionByIdAdmin,
  updatePromotionAdmin,
  deletePromotionAdmin,
} from "../controllers/promotionController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";

const router = express.Router();

// Public route
router.get("/", getActivePromotions);

// Admin routes
router.post("/admin", authMiddleware, adminMiddleware, createPromotion);
router.get("/admin", authMiddleware, adminMiddleware, getAllPromotionsAdmin);
router.get(
  "/admin/:id",
  authMiddleware,
  adminMiddleware,
  getPromotionByIdAdmin
);
router.put("/admin/:id", authMiddleware, adminMiddleware, updatePromotionAdmin);
router.delete(
  "/admin/:id",
  authMiddleware,
  adminMiddleware,
  deletePromotionAdmin
);

export default router;
