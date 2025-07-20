import express from "express";
import authMiddleware from "../middleware/authMiddleware.js"; // ✅ FIXED
import operatorOnly from "../middleware/operatorMiddleware.js";
import {
  getOperatorBuses,
  getOperatorBusById,
} from "../controllers/operatorBusController.js";

const router = express.Router();

// ✅ GET /api/operator/buses - fetch only operator's buses
router.get("/", authMiddleware, operatorOnly, getOperatorBuses);

// ✅ GET /api/operator/buses/:id - fetch single bus (if belongs to operator)
router.get("/:id", authMiddleware, operatorOnly, getOperatorBusById);

export default router;
