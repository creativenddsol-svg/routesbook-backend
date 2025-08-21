// models/Notice.js
import mongoose from "mongoose";

const noticeSchema = new mongoose.Schema(
  {
    /* ───── Image Notice Content ───── */
    imageUrl: {
      type: String,
      required: [true, "Image URL is required"],
      trim: true,
    },

    /* ───── Status & Visibility ───── */
    isActive: {
      type: Boolean,
      default: true,
    },
    expiresAt: {
      type: Date, // Optional expiry for auto-hide
    },

    /* ───── Optional Metadata (future use) ───── */
    label: {
      type: String,
      trim: true,
      default: "", // Optional alt text or caption
    },
    link: {
      type: String,
      trim: true,
      default: "", // Optional redirect URL
    },
  },
  {
    timestamps: true, // Adds createdAt & updatedAt
  }
);

// Add an index for faster expiry lookups
noticeSchema.index({ expiresAt: 1 });

const Notice = mongoose.model("Notice", noticeSchema);

export default Notice;
