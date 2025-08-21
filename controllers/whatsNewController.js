// controllers/whatsNewController.js
import asyncHandler from "express-async-handler";
import WhatsNew from "../models/WhatsNew.js";

/* Create */
export const createItem = asyncHandler(async (req, res) => {
  let { title, subtitle, imageUrl, tag, link, isActive, sortOrder, expiresAt } =
    req.body;

  if (!title || !imageUrl) {
    res.status(400);
    throw new Error("title and imageUrl are required");
  }

  if (typeof isActive === "undefined") isActive = true;
  if (typeof sortOrder === "undefined") sortOrder = 0;

  let exp;
  if (expiresAt) {
    const d = new Date(expiresAt);
    if (!isNaN(d)) exp = d;
  }

  const doc = await WhatsNew.create({
    title,
    subtitle,
    imageUrl,
    tag,
    link,
    isActive,
    sortOrder,
    expiresAt: exp,
  });

  res.status(201).json(doc);
});

/* Admin list */
export const getAll = asyncHandler(async (_req, res) => {
  const items = await WhatsNew.find({}).sort({ sortOrder: 1, createdAt: -1 });
  res.json(items);
});

/* Public list (active only) */
export const getActive = asyncHandler(async (_req, res) => {
  const now = new Date();
  const items = await WhatsNew.find({
    isActive: true,
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gte: now } }],
  })
    .sort({ sortOrder: 1, createdAt: -1 })
    .limit(6); // only show a row
  res.json(items);
});

/* Update */
export const updateItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const doc = await WhatsNew.findById(id);
  if (!doc) {
    res.status(404);
    throw new Error("Item not found");
  }

  const {
    title,
    subtitle,
    imageUrl,
    tag,
    link,
    isActive,
    sortOrder,
    expiresAt,
  } = req.body;

  if (typeof title !== "undefined") doc.title = title;
  if (typeof subtitle !== "undefined") doc.subtitle = subtitle;
  if (typeof imageUrl !== "undefined") doc.imageUrl = imageUrl;
  if (typeof tag !== "undefined") doc.tag = tag;
  if (typeof link !== "undefined") doc.link = link;
  if (typeof isActive !== "undefined") doc.isActive = Boolean(isActive);
  if (typeof sortOrder !== "undefined") doc.sortOrder = Number(sortOrder);

  if (typeof expiresAt !== "undefined") {
    if (!expiresAt) doc.expiresAt = undefined;
    else {
      const d = new Date(expiresAt);
      if (!isNaN(d)) doc.expiresAt = d;
    }
  }

  const updated = await doc.save();
  res.json(updated);
});

/* Delete */
export const deleteItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const doc = await WhatsNew.findById(id);
  if (!doc) {
    res.status(404);
    throw new Error("Item not found");
  }
  await doc.deleteOne();
  res.json({ message: "Item deleted" });
});
