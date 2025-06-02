import express from "express";
import { getAuditLogs } from "../controllers/auditController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js"; // ensure only admins can view logs

const router = express.Router();

router.get("/", authMiddleware, adminMiddleware, getAuditLogs);

export default router;
