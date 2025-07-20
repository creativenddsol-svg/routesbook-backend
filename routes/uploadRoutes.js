import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

/* ──────────────────────────────────────────────────────────
   1. Ensure /uploads directory exists
────────────────────────────────────────────────────────── */
const uploadsDir = path.join(path.resolve(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

/* ──────────────────────────────────────────────────────────
   2. Multer storage configuration
────────────────────────────────────────────────────────── */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`),
});

/* ──────────────────────────────────────────────────────────
   3. File-type filter: accept images only
────────────────────────────────────────────────────────── */
const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp|gif/;
  const mime = file.mimetype.split("/")[1];
  if (allowed.test(mime)) cb(null, true);
  else cb(new Error("Only image files are allowed"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB max
});

/* ──────────────────────────────────────────────────────────
   4. POST /api/upload/profile-picture
────────────────────────────────────────────────────────── */
router.post(
  "/profile-picture",
  authMiddleware,
  (req, res, next) => {
    upload.single("image")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      next();
    });
  },
  (req, res) => {
    const baseUrl = process.env.SERVER_URL || "http://localhost:5000";
    const imageUrl = `${baseUrl}/uploads/${req.file.filename}`;
    res.json({ imageUrl });
  }
);

export default router;
