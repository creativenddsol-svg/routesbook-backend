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
import adminPaymentRoutes from "./routes/adminPaymentRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import noticeRoutes from "./routes/noticeRoutes.js";
import whatsNewRoutes from "./routes/whatsNewRoutes.js";

// --- Middleware Imports ---
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";

// Load environment variables
dotenv.config();

// --- Initialize Express app ---
const app = express();

// 🔒 Proxy awareness (Render, CDNs) — needed for correct IPs & secure cookies
app.set("trust proxy", 1);

// --- Database Connection ---
connectDB(); // uses your ./config/db.js and process.env.MONGO_URI

// --- Core Middleware Setup ---

// 1) Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(
    morgan("combined", {
      stream: { write: (message) => logger.http(message.trim()) },
    })
  );
}

// 2) Security headers
app.use(helmet());

// 3) CORS (multi-origin allowlist for Cloudflare Pages, localhost, custom domains)
const defaultOrigins = ["http://localhost:3000", "http://localhost:5173"];
const envOrigins = (process.env.CORS_ALLOWLIST || process.env.CLIENT_URL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const ALLOWLIST = Array.from(new Set([...defaultOrigins, ...envOrigins]));

app.use(
  cors({
    origin(origin, cb) {
      // allow tools with no Origin (curl/Postman)
      if (!origin) return cb(null, true);
      const ok = ALLOWLIST.includes(origin);
      cb(ok ? null : new Error(`CORS blocked: ${origin}`), ok);
    },
    credentials: true,
  })
);

// 4) Rate limiting (global for /api — tune if needed)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again after 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", apiLimiter);

// 5) Sanitization
app.use(sanitize);

// 6) Parsers
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

// 7) Compression
app.use(compression());

// --- Health Check (Render uses this) ---
app.get("/health", (_req, res) => res.status(200).send("OK"));

// --- Static File Serving with permissive CORS for images ---
const __dirname = path.resolve();

// Set CORS headers for /uploads responses (so images load on your FE domain)
app.use("/uploads", (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWLIST.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else {
    res.setHeader(
      "Access-Control-Allow-Origin",
      process.env.CLIENT_URL || "http://localhost:3000"
    );
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  // allow cross-origin display of images
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});
app.use("/uploads", express.static(path.join(__dirname, "/uploads")));

// --- API Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminPaymentRoutes);
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
app.use("/api/upload", uploadRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/whats-new", whatsNewRoutes);

// --- Dev-only Routes ---
if (process.env.NODE_ENV === "development") {
  app.use("/api/dev", devRoutes);
}

// --- Errors ---
app.use(notFound);
app.use(errorHandler);

// --- Start Server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  logger.info(
    `🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`
  );
});
