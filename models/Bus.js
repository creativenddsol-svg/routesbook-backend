import mongoose from "mongoose";

// Sub-schema for defining boarding or dropping points with time and location.
const pointSchema = new mongoose.Schema(
  {
    time: { type: String, required: true, trim: true },
    point: { type: String, required: true, trim: true },
  },
  { _id: false }
);

// Sub-schema for defining fare between two specific points.
const fareSchema = new mongoose.Schema(
  {
    boardingPoint: { type: String, required: true },
    droppingPoint: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

// Sub-schema for individual trip turn
const tripTurnSchema = new mongoose.Schema(
  {
    departureTime: { type: String, required: true },
    arrivalTime: { type: String, required: true },
  },
  { _id: false }
);

// Sub-schema for daily rotation intervals with multiple trips
const rotationIntervalSchema = new mongoose.Schema(
  {
    dayOffset: { type: Number, required: true }, // e.g. 0 = first day
    turns: [tripTurnSchema], // multiple trips for same day
  },
  { _id: false }
);

const busSchema = new mongoose.Schema(
  {
    // --- Core Bus Details ---
    name: { type: String, required: true, trim: true },
    from: { type: String, required: true, trim: true },
    to: { type: String, required: true, trim: true },
    date: { type: String, required: true },
    departureTime: { type: String, required: true },
    arrivalTime: { type: String, required: true },
    busType: {
      type: String,
      enum: ["AC", "Non-AC"],
      required: true,
    },
    seatLayout: { type: Array, required: true },
    operatorLogo: { type: String, default: "" },

    // --- Availability and Status ---
    unavailableDates: [{ type: String }],
    isAvailable: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false },

    // --- Rotating Schedule ---
    rotationSchedule: {
      isRotating: { type: Boolean, default: false },
      startDate: { type: String },
      rotationLength: { type: Number },
      intervals: [rotationIntervalSchema],
    },

    // --- Features and Offers ---
    features: {
      wifi: { type: Boolean, default: false },
      chargingPort: { type: Boolean, default: false },
    },
    trendingOffer: {
      isActive: { type: Boolean, default: false },
      discountPercent: { type: Number, default: 0 },
      message: { type: String, default: "" },
      expiry: { type: Date },
      imageUrl: { type: String, default: "" },
    },

    // --- Operator and Pricing ---
    operator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },

    // ✅ FIXED: Convenience Fee Structure
    convenienceFee: {
      amountType: {
        type: String,
        enum: ["fixed", "percentage"],
        default: "fixed",
      },
      value: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    fares: [fareSchema],
    boardingPoints: [pointSchema],
    droppingPoints: [pointSchema],
  },
  {
    timestamps: true,
  }
);

const Bus = mongoose.model("Bus", busSchema);

export default Bus;
