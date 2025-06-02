// server/controllers/auditController.js
import AuditLog from "../models/AuditLog.js";
import asyncHandler from "../utils/asyncHandler.js";

// @desc    Admin: Get audit logs with filters
// @route   GET /api/admin/audit-logs
// @access  Admin
export const getAuditLogs = asyncHandler(async (req, res) => {
  const {
    email = "", // user email (partial match)
    action = "", // action type (exact match)
    startDate, // start of date range
    endDate, // end of date range
    page = 1, // pagination page
    limit = 10, // pagination limit
  } = req.query;

  const query = {};

  // 🔍 Filter by action type
  if (action) {
    query.action = action;
  }

  // 📅 Filter by date range
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  // 🧾 Get all matching logs
  const logs = await AuditLog.find(query)
    .populate("user", "name email")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  // 🧮 Apply post-query email filtering (since email is in populated data)
  const filteredLogs = email
    ? logs.filter((log) =>
        log.user?.email?.toLowerCase().includes(email.toLowerCase())
      )
    : logs;

  // 🧮 Count total (basic estimate since email filter is in-memory)
  const total = email
    ? filteredLogs.length
    : await AuditLog.countDocuments(query);

  res.json({
    logs: filteredLogs,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / limit),
  });
});
