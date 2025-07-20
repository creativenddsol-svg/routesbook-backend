// server/models/Promotion.js
import mongoose from "mongoose";

const promotionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true }, // For admin reference & alt text
    imageUrl: { type: String, required: true },
    link: { type: String, trim: true }, // Optional: if you decide to make them clickable later
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 }, // For controlling sequence
    startDate: { type: Date },
    endDate: { type: Date },
    // You can add more fields like target audience, specific routes, etc. later
  },
  { timestamps: true }
);

export default mongoose.model("Promotion", promotionSchema);
