// routes/journeyRoutes.js
import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
import {
  addJourney,
  updateJourney,
  deleteJourney,
  getJourneys,
  getJourneyById,
  getPaginatedJourneys,
} from "../controllers/journeyController.js";

const router = express.Router();

// Public routes for searching and viewing journeys
router.get("/", getJourneys); // Main search endpoint for users
router.get("/:id", getJourneyById);

// Admin-only routes for managing specific journey instances
router.post("/", authMiddleware, adminMiddleware, addJourney);
router.put("/:id", authMiddleware, adminMiddleware, updateJourney);
router.delete("/:id", authMiddleware, adminMiddleware, deleteJourney);
router.get("/paginated", authMiddleware, adminMiddleware, getPaginatedJourneys); // Admin view for all journeys

export default router;
