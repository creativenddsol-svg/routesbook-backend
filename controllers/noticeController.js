// controllers/noticeController.js
import Notice from "../models/Notice.js";
import asyncHandler from "express-async-handler";

/* ─────────────────────────────────────────────────────────
   Create a new notice (Admin)
────────────────────────────────────────────────────────── */
export const createNotice = asyncHandler(async (req, res) => {
  let { imageUrl, isActive, expiresAt, label, link } = req.body;

  if (!imageUrl) {
    res.status(400);
    throw new Error("Image URL is required");
  }

  // sensible defaults
  if (typeof isActive === "undefined") isActive = true;

  // normalize expiresAt (optional)
  let expires = undefined;
  if (expiresAt) {
    const d = new Date(expiresAt);
    if (!isNaN(d.getTime())) expires = d;
  }

  const notice = await Notice.create({
    imageUrl,
    isActive,
    expiresAt: expires,
    label,
    link,
  });

  res.status(201).json(notice);
});

/* ─────────────────────────────────────────────────────────
   Get all notices (Admin list)
────────────────────────────────────────────────────────── */
export const getAllNotices = asyncHandler(async (_req, res) => {
  const notices = await Notice.find({}).sort({ createdAt: -1 });
  res.json(notices);
});

/* ─────────────────────────────────────────────────────────
   Get active notices (Public)
   - Only isActive === true
   - And not expired (no expiresAt OR expiresAt >= now)
────────────────────────────────────────────────────────── */
export const getActiveNotices = asyncHandler(async (_req, res) => {
  const now = new Date();
  const active = await Notice.find({
    isActive: true,
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gte: now } }],
  }).sort({ createdAt: -1 });

  res.json(active);
});

/* ─────────────────────────────────────────────────────────
   Delete a notice by ID (Admin)
────────────────────────────────────────────────────────── */
export const deleteNotice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const notice = await Notice.findById(id);
  if (!notice) {
    res.status(404);
    throw new Error("Notice not found");
  }

  await notice.deleteOne();
  res.json({ message: "Notice deleted" });
});

/* ─────────────────────────────────────────────────────────
   Update a notice by ID (Admin)
   - Supports partial updates
   - Safe handling for isActive & expiresAt
   - To clear an expiry, send expiresAt: null or ""
────────────────────────────────────────────────────────── */
export const updateNotice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const notice = await Notice.findById(id);
  if (!notice) {
    res.status(404);
    throw new Error("Notice not found");
  }

  const { imageUrl, isActive, expiresAt, label, link } = req.body;

  if (typeof imageUrl !== "undefined" && imageUrl !== "") {
    notice.imageUrl = imageUrl;
  }
  if (typeof isActive !== "undefined") {
    notice.isActive = Boolean(isActive);
  }

  if (typeof expiresAt !== "undefined") {
    if (expiresAt === null || expiresAt === "") {
      notice.expiresAt = undefined; // clear expiry
    } else {
      const d = new Date(expiresAt);
      if (!isNaN(d.getTime())) {
        notice.expiresAt = d;
      }
    }
  }

  if (typeof label !== "undefined") notice.label = label;
  if (typeof link !== "undefined") notice.link = link;

  const updated = await notice.save();
  res.json(updated);
});
