// models/SpecialNotice.js
import mongoose from "mongoose";

const specialNoticeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    imageUrl: { type: String, required: true, trim: true },
    link: { type: String, default: "#", trim: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    // Optional chip/badge text shown on the card if provided
    label: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("SpecialNotice", specialNoticeSchema);
