// routes/operatorRoutes.js
import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import operatorMiddleware from "../middleware/operatorMiddleware.js";

// ✅ point to the correct controller file
import { getOperatorDashboard } from "../controllers/operatorController.js";

const router = express.Router();

// GET /api/operator/dashboard
router.get(
  "/dashboard",
  authMiddleware, // user must be logged in
  operatorMiddleware, // user must have role 'operator'
  getOperatorDashboard // controller logic
);

export default router;
