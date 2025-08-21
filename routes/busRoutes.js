import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
import {
  addBus,
  updateBus,
  deleteBus,
  getBuses,
  getPaginatedBuses,
  getBusById,
  // IMPORT a function for the logic that was previously in this file
  getTrendingBuses,
  // IMPORT the new function to fix the bug
  updateTrendingOffer,
} from "../controllers/busController.js";

const router = express.Router();

// --- ADMIN-ONLY ROUTES ---
router.post("/", authMiddleware, adminMiddleware, addBus);
router.put("/:id", authMiddleware, adminMiddleware, updateBus);
router.delete("/:id", authMiddleware, adminMiddleware, deleteBus);

// === FIX ===
// This route now calls the 'updateTrendingOffer' function from the controller.
// This function contains the corrected logic to properly save the offer to the database.
router.put(
  "/:id/trending-offer",
  authMiddleware,
  adminMiddleware,
  updateTrendingOffer
);

// --- PUBLIC ROUTES ---
router.get("/paginated", getPaginatedBuses);

// === FIX ===
// This route now calls the 'getTrendingBuses' function from the controller.
// The logic is now centralized in one place.
router.get("/trending", getTrendingBuses);

// NOTE: Generic routes are placed at the end to ensure specific routes are matched first.
router.get("/:id", getBusById);
router.get("/", getBuses);

export default router;
