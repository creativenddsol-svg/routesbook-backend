// models/Journey.js
import mongoose from "mongoose";

// Re-use point and fare schemas from Bus.js for consistency,
// or define them here if you want them to be completely independent.
// For now, let's assume they are embedded directly.
const pointSchema = new mongoose.Schema(
  {
    time: { type: String, required: true, trim: true },
    point: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const fareSchema = new mongoose.Schema(
  {
    boardingPoint: { type: String, required: true },
    droppingPoint: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const journeySchema = new mongoose.Schema(
  {
    bus: {
      // Reference to the actual physical bus template
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
    },
    journeyDate: {
      // The specific date this journey runs
      type: Date,
      required: true,
    },
    departureTime: {
      type: String, // e.g., "07:30"
      required: true,
    },
    arrivalTime: {
      type: String, // e.g., "12:00"
      required: true,
    },
    from: {
      // Duplicated from Bus for easier querying
      type: String,
      required: true,
      trim: true,
    },
    to: {
      // Duplicated from Bus for easier querying
      type: String,
      required: true,
      trim: true,
    },
    busType: {
      // Duplicated from Bus for easier querying
      type: String,
      enum: ["AC", "Non-AC"],
      required: true,
    },
    seatLayout: {
      // Copied from Bus at generation time
      type: Array,
      required: true,
    },
    // Price, fares, points for THIS specific journey instance
    price: {
      type: Number,
      required: true,
      min: [0, "Price cannot be negative."],
    },
    fares: [fareSchema],
    boardingPoints: [pointSchema],
    droppingPoints: [pointSchema],

    unavailableSeats: [{ type: String }], // Seats blocked for THIS specific journey instance

    isCanceled: {
      // To cancel a specific journey instance
      type: Boolean,
      default: false,
    },

    // Potentially copy trendingOffer details if they are journey-specific
    // or fetch them from the Bus on demand. For now, we'll keep trendingOffer
    // on the Bus template as it's often a general promotion for a bus.

    // To track when this journey was last updated (e.g., seats booked)
    lastUpdatedAvailability: { type: Date, default: Date.now },
  },
  {
    timestamps: true, // `createdAt` and `updatedAt` for the journey instance
  }
);

// Add an index for efficient searching by date and route
journeySchema.index({ journeyDate: 1, from: 1, to: 1 });
journeySchema.index({ bus: 1, journeyDate: 1 }, { unique: true }); // A bus should ideally have only one journey per day (at a specific time, handled by controller)

const Journey = mongoose.model("Journey", journeySchema);

export default Journey;
