import mongoose from "mongoose";

const specialNoticeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    imageUrl: { type: String, required: true },
    link: { type: String, default: "#" },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("SpecialNotice", specialNoticeSchema);
