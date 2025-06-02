// server/index.js
import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import os from "os";

import sanitize from "./middleware/sanitizeMiddleware.js";
import logger from "./utils/logger.js";

// ✅ Load environment variables
dotenv.config();

// ✅ Debug environment variables (development only)
if (process.env.NODE_ENV !== "production") {
  console.log("🧪 DEBUG ENVIRONMENT VARIABLES:");
  console.log("→ MONGO_URI:", process.env.MONGO_URI);
  console.log("→ NODE_ENV:", process.env.NODE_ENV);
  console.log("→ EMAIL_FROM:", process.env.EMAIL_FROM);
}

// ✅ Initialize Express app
const app = express();

// ✅ Enforce HTTPS in production
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    if (req.headers["x-forwarded-proto"] !== "https") {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// ✅ Security Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);
app.use(helmet());
app.use(sanitize);
app.use(cookieParser());
app.use(express.json({ limit: "10kb" }));

// ✅ Logging with Morgan & Winston
app.use(
  morgan("combined", {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  })
);

// ✅ Basic rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: "⚠️ Too many requests, try again later.",
});
app.use("/api", limiter);

// ✅ MongoDB Connection
import connectDB from "./config/db.js";
connectDB();

// ✅ Routes
import authRoutes from "./routes/authRoutes.js";
import protectedRoutes from "./routes/protectedRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import busRoutes from "./routes/busRoutes.js";
import usersRoutes from "./routes/usersRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import auditRoutes from "./routes/auditRoutes.js";
import seatLockRoutes from "./routes/seatLockRoutes.js"; // ✅ New: Seat locking routes

// ✅ Error Middleware
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";

// ✅ Mount API Routes
app.use("/api/auth", authRoutes);
app.use("/api/protected", protectedRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/buses", busRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/audits", auditRoutes);
app.use("/api", seatLockRoutes); // ✅ Add seat lock endpoints

// ✅ Global error handlers
app.use(notFound);
app.use(errorHandler);

// ✅ Start Server
const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  const getLocalIP = () => {
    const interfaces = os.networkInterfaces();
    for (const iface of Object.values(interfaces)) {
      for (const config of iface) {
        if (config.family === "IPv4" && !config.internal) {
          return config.address;
        }
      }
    }
    return "localhost";
  };

  const localIP = getLocalIP();

  console.log(`🚀 Server running:
  ➤ Local:   http://localhost:${PORT}
  ➤ Network: http://${localIP}:${PORT}`);
});
