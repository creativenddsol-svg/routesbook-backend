import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(path.resolve(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`),
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp|gif/;
  const mime = file.mimetype.split("/")[1];
  if (allowed.test(mime)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, PNG, GIF, and WebP files are allowed."), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

// ✅ USE middleware chain properly here
router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  upload.single("image"), // ✅ middleware parsed before handler
  (req, res) => {
    // ✅ Handle multer and file checks
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const baseUrl = process.env.SERVER_URL || "http://localhost:5000";
    const imageUrl = `${baseUrl}/uploads/${req.file.filename}`;

    res.status(200).json({ imageUrl });
  }
);

export default router;
