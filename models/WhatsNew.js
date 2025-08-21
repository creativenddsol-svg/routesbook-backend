// models/WhatsNew.js
import mongoose from "mongoose";

const whatsNewSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    subtitle: { type: String, trim: true, maxlength: 140 }, // small helper text
    imageUrl: { type: String, required: true, trim: true },

    // if you want a small pill/tag at top-left (e.g., "New")
    tag: { type: String, trim: true, default: "" },

    link: { type: String, trim: true, default: "" }, // optional deeplink
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },

    // optional expiry for auto-hide
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

// speed up queries by these
whatsNewSchema.index({ isActive: 1, expiresAt: 1, sortOrder: 1 });

const WhatsNew = mongoose.model("WhatsNew", whatsNewSchema);
export default WhatsNew;
