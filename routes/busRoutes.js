import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
import asyncHandler from "express-async-handler";
import Bus from "../models/Bus.js";
import {
  addBus,
  updateBus,
  deleteBus,
  getBuses,
  getPaginatedBuses,
  getBusById,
} from "../controllers/busController.js";

const router = express.Router();

// Admin-only routes
router.post("/", authMiddleware, adminMiddleware, addBus);
router.put("/:id", authMiddleware, adminMiddleware, updateBus);
router.delete("/:id", authMiddleware, adminMiddleware, deleteBus);

// --- ✅ FINAL CORRECTED ROUTE FOR UPDATING THE OFFER ---
router.put(
  "/:id/trending-offer",
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const { trendingOffer } = req.body;
    const bus = await Bus.findById(req.params.id);

    if (!bus) {
      res.status(404);
      throw new Error("Bus not found");
    }

    // ✅ Fix: Merge with existing fields to avoid losing any data
    bus.trendingOffer = {
      ...bus.trendingOffer, // keep any existing fields
      isActive: trendingOffer.isActive,
      message: trendingOffer.message,
      discountPercent: trendingOffer.discountPercent,
      expiry: trendingOffer.expiry,
      imageUrl: trendingOffer.imageUrl, // ✅ ensure imageUrl is included
    };

    const updatedBus = await bus.save();

    res.json({
      message: "Trending offer updated successfully",
      bus: updatedBus,
    });
  })
);

// Public routes
router.get("/paginated", getPaginatedBuses);

// ✅ RENAMED to a more descriptive route and ensures non-expired
router.get(
  "/special-offers",
  asyncHandler(async (req, res) => {
    const today = new Date();
    const specialOfferBuses = await Bus.find({
      "trendingOffer.isActive": true,
      "trendingOffer.expiry": { $gte: today },
    }).limit(6);
    res.json(specialOfferBuses);
  })
);

router.get("/:id", getBusById);
router.get("/", getBuses);

export default router;
