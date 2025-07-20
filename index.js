import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import compression from "compression";
import path from "path";
import sanitize from "./middleware/sanitizeMiddleware.js";
import logger from "./utils/logger.js";
import connectDB from "./config/db.js";

// --- Route Imports ---
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import busRoutes from "./routes/busRoutes.js";
import usersRoutes from "./routes/usersRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import operatorRoutes from "./routes/operatorRoutes.js";
import specialNoticeRoutes from "./routes/specialNoticeRoutes.js";
import devRoutes from "./routes/devRoutes.js";
import journeyRoutes from "./routes/journeyRoutes.js";
import operatorProfileRoutes from "./routes/operatorProfileRoutes.js";
import operatorBusRoutes from "./routes/operatorBusRoutes.js";
import operatorBookingRoutes from "./routes/operatorBookingRoutes.js";
import adminPaymentRoutes from "./routes/adminPaymentRoutes.js"; // ✅ New payment route
import uploadRoutes from "./routes/uploadRoutes.js"; // ✅ Upload route

// --- Middleware Imports ---
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";

// Load environment variables
dotenv.config();

// --- Initialize Express app ---
const app = express();

// --- Core Middleware ---
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use(sanitize);

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(
    morgan("combined", {
      stream: { write: (message) => logger.http(message.trim()) },
    })
  );
}

// --- Rate Limiting ---
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again after 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", apiLimiter);

// --- Development Tools ---
app.use("/api/dev", devRoutes);

// --- Database Connection ---
connectDB();

// ✅ Serve static uploaded files
const __dirname = path.resolve();
app.use("/uploads", express.static(path.join(__dirname, "/uploads")));

// --- API Route Mounting ---
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminPaymentRoutes); // ✅ Admin payment routes
app.use("/api/buses", busRoutes);
app.use("/api/journeys", journeyRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/operator", operatorRoutes);
app.use("/api/operator/buses", operatorBusRoutes);
app.use("/api/operator/bookings", operatorBookingRoutes);
app.use("/api/special-notices", specialNoticeRoutes);
app.use("/api/operator-profile", operatorProfileRoutes);
app.use("/api/upload", uploadRoutes); // ✅ Upload route

// --- Global Error Handling ---
app.use(notFound);
app.use(errorHandler);

// --- Start Server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(
    `🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`
  );
});
