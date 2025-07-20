import express from "express";
import authMiddleware from "../middleware/authMiddleware.js"; // ✅ FIXED
import operatorOnly from "../middleware/operatorMiddleware.js";

import {
  getOperatorBookedSeats,
  createManualBooking,
} from "../controllers/operatorBookingController.js";

const router = express.Router();

// ✅ GET booked seats for a bus (operator view)
router.get(
  "/booked-seats",
  authMiddleware,
  operatorOnly,
  getOperatorBookedSeats
);

// ✅ POST manual booking (for phone call/offline users)
router.post("/manual", authMiddleware, operatorOnly, createManualBooking);

export default router;
