import mongoose from "mongoose";

const busSchema = new mongoose.Schema({
  name: { type: String, required: true },
  from: { type: String, required: true },
  to: { type: String, required: true },
  date: { type: String, required: true },
  departureTime: { type: String, required: true },
  arrivalTime: { type: String, required: true },
  busType: { type: String, enum: ["AC", "Non-AC"], required: true },
  seatLayout: { type: Array, required: true },
  price: { type: Number, required: true },

  unavailableDates: [{ type: String }],
  isAvailable: { type: Boolean, default: true },

  features: {
    wifi: { type: Boolean, default: false },
    chargingPort: { type: Boolean, default: false },
  },

  // ✅ Trending Offer Section (Manual)
  trendingOffer: {
    isActive: { type: Boolean, default: false },
    discountPercent: { type: Number, default: 0 },
    message: { type: String },
    expiry: { type: Date },
  },
});

export default mongoose.model("Bus", busSchema);
