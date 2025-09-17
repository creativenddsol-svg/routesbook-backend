import mongoose from "mongoose";

const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // e.g. "bookingNo:20250917"
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
);

export default mongoose.model("Counter", counterSchema);
