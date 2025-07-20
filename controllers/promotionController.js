// server/controllers/promotionController.js
import Promotion from "../models/Promotion.js";
import asyncHandler from "../utils/asyncHandler.js";

// @desc    Get all active promotions (for public carousel)
// @route   GET /api/promotions
export const getActivePromotions = asyncHandler(async (req, res) => {
  const today = new Date();
  const promotions = await Promotion.find({
    isActive: true,
    $or: [{ startDate: { $exists: false } }, { startDate: { $lte: today } }],
    $or: [{ endDate: { $exists: false } }, { endDate: { $gte: today } }],
  }).sort({ displayOrder: 1, createdAt: -1 });
  res.json(promotions);
});

// --- Admin Only Controllers ---

// @desc    Create a new promotion (Admin)
// @route   POST /api/admin/promotions
export const createPromotion = asyncHandler(async (req, res) => {
  const { title, imageUrl, link, isActive, displayOrder, startDate, endDate } =
    req.body;
  if (!title || !imageUrl) {
    res.status(400);
    throw new Error("Title and Image URL are required for promotion.");
  }
  const promotion = await Promotion.create({
    title,
    imageUrl,
    link,
    isActive,
    displayOrder,
    startDate,
    endDate,
  });
  res.status(201).json(promotion);
});

// @desc    Get all promotions (Admin)
// @route   GET /api/admin/promotions
export const getAllPromotionsAdmin = asyncHandler(async (req, res) => {
  const promotions = await Promotion.find({}).sort({
    displayOrder: 1,
    createdAt: -1,
  });
  res.json(promotions);
});

// @desc    Get promotion by ID (Admin)
// @route   GET /api/admin/promotions/:id
export const getPromotionByIdAdmin = asyncHandler(async (req, res) => {
  const promotion = await Promotion.findById(req.params.id);
  if (promotion) {
    res.json(promotion);
  } else {
    res.status(404);
    throw new Error("Promotion not found");
  }
});

// @desc    Update a promotion (Admin)
// @route   PUT /api/admin/promotions/:id
export const updatePromotionAdmin = asyncHandler(async (req, res) => {
  const promotion = await Promotion.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (promotion) {
    res.json(promotion);
  } else {
    res.status(404);
    throw new Error("Promotion not found");
  }
});

// @desc    Delete a promotion (Admin)
// @route   DELETE /api/admin/promotions/:id
export const deletePromotionAdmin = asyncHandler(async (req, res) => {
  const promotion = await Promotion.findByIdAndDelete(req.params.id);
  if (promotion) {
    res.json({ message: "Promotion removed" });
  } else {
    res.status(404);
    throw new Error("Promotion not found");
  }
});
