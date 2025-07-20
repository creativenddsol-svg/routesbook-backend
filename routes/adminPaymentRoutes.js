import express from "express";
import {
  getPendingPayments,
  markOperatorPaid,
  getPaymentHistory, // ✅ Step 6: New controller
} from "../controllers/operatorPaymentController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ GET: View pending payment summaries per operator
router.get("/payments/pending", authMiddleware, getPendingPayments);

// ✅ POST: Mark bookings as paid and create payment record
router.post("/payments/pay", authMiddleware, markOperatorPaid);

// ✅ GET: View past payment history
router.get("/payments/history", authMiddleware, getPaymentHistory);

export default router;
