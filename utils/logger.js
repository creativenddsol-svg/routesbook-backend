import { createLogger, format, transports } from "winston";
import "winston-daily-rotate-file"; // ✅ Add daily rotation support

// ✅ Create daily rotating file transport
const dailyRotateTransport = new transports.DailyRotateFile({
  filename: "logs/%DATE%-combined.log",
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "14d", // Keep logs for 14 days
  level: "info", // Log level for this transport
});

// ✅ Create the logger
const logger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp(),
    format.printf(
      ({ timestamp, level, message }) =>
        `[${timestamp}] ${level.toUpperCase()}: ${message}`
    )
  ),
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }), // Color console logs
    new transports.File({ filename: "logs/error.log", level: "error" }), // Error logs
    dailyRotateTransport, // ✅ Rotating daily logs
  ],
});

export default logger;
