import winston from "winston";
import AuditLog from "../models/AuditLog.js";
import mongoose from "mongoose";

/**
 * Winston logger for structured logging to file and console
 */
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: "logs/audit.log",
      level: "info",
    }),
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

/**
 * Logs a user action into MongoDB and Winston logs
 * @param {String} userId - ID of the user performing the action
 * @param {String} action - Action performed (e.g. "LOGIN", "BOOK", "CANCEL", "PROFILE_UPDATE")
 * @param {Object} details - Optional metadata about the action (e.g. busId, seat numbers, payload changes)
 * @param {String|null} ip - Optional IP address for traceability
 */
const logAudit = async (userId, action, details = {}, ip = null) => {
  try {
    const logEntry = {
      user: mongoose.Types.ObjectId.isValid(userId) ? userId : null,
      action: action.trim().toUpperCase(),
      details,
      ip,
    };

    // Save to MongoDB AuditLog collection
    await AuditLog.create(logEntry);

    // Also log to Winston file & console
    logger.info(
      `AUDIT: ${action} - User: ${userId} - Details: ${JSON.stringify(
        details
      )} - IP: ${ip || "N/A"}`
    );
  } catch (error) {
    logger.error(`❌ Failed to create audit log: ${error.message}`);
  }
};

export default logAudit;
