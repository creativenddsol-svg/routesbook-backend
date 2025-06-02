import logger from "../utils/logger.js"; // ✅ Ensure Winston logger is set up

// 404 Not Found Middleware
export const notFound = (req, res, next) => {
  const error = new Error(`🔍 Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Global Error Handler Middleware
export const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);

  // Log error details (Winston will log to file + console)
  logger.error(`${req.method} ${req.originalUrl} → ${err.message}`);

  res.json({
    message: err.message || "Something went wrong",
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
};
