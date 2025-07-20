import mongoose from "mongoose";

const busOperatorSchema = new mongoose.Schema(
  {
    // Basic Info
    name: { type: String, required: true },
    logoUrl: { type: String }, // ✅ Logo image
    bannerUrl: { type: String }, // ✅ Banner image
    description: { type: String }, // ✅ About Us / Story
    website: { type: String },
    contactEmail: { type: String },
    contactPhone: { type: String },
    active: { type: Boolean, default: true },

    // Operating Info
    operatingCities: [{ type: String }], // ✅ Operating cities / routes
    yearsInService: { type: Number }, // ✅ Years in service
    busTypes: [{ type: String }], // e.g., AC, Non-AC, luxury, etc.

    // Trust & Recognition
    awards: [{ type: String }], // e.g., ["Best Operator 2025", "Top Choice"]

    // Fleet Showcase (array of bus images)
    fleetImages: [{ type: String }], // ✅ URLs to bus images

    // Optional: Tie-in to existing trending offers (via referencing offer IDs if you want to)
    trendingOffers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Bus" }],

    // Optional: Ratings (average & count)
    averageRating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("BusOperator", busOperatorSchema);
