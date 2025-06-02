import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
import {
  addBus,
  updateBus,
  deleteBus,
  getBuses,
  getPaginatedBuses,
} from "../controllers/busController.js";

import Bus from "../models/Bus.js";
import asyncHandler from "express-async-handler";

const router = express.Router();

// 🔐 Admin-only routes
router.post("/", authMiddleware, adminMiddleware, addBus);
router.put("/:id", authMiddleware, adminMiddleware, updateBus);
router.delete("/:id", authMiddleware, adminMiddleware, deleteBus);

// 🌐 Public routes
router.get("/paginated", getPaginatedBuses);
router.get("/", getBuses);

// ✅ NEW: Trending Offers (public)
router.get(
  "/trending",
  asyncHandler(async (req, res) => {
    const trendingBuses = await Bus.find({
      "trendingOffer.isActive": true,
    }).limit(6);
    res.json(trendingBuses);
  })
);

export default router;
