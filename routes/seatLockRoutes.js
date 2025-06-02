// server/routes/seatLockRoutes.js

import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { lockSeats } from "../controllers/seatLockController.js";

const router = express.Router();

router.post("/bus/:busId/seat-lock", authMiddleware, lockSeats);

export default router;
