import Bus from "../models/Bus.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getBusTurnsOnDate } from "../utils/rotationUtils.js";

// @desc    Get all buses belonging to the logged-in operator (with turns)
// @route   GET /api/operator/buses
// @access  Private (Operator only)
export const getOperatorBuses = asyncHandler(async (req, res) => {
  const operatorId = req.user._id;
  const { date } = req.query;
  const today = new Date();

  // ✅ Debug print
  console.log("✅ Operator ID (from token):", operatorId.toString());

  let buses = await Bus.find({ operator: operatorId });

  // Auto-disable expired offers
  buses = buses.map((bus) => {
    if (
      bus.trendingOffer?.isActive &&
      bus.trendingOffer.expiry &&
      new Date(bus.trendingOffer.expiry) < today
    ) {
      bus.trendingOffer.isActive = false;
    }
    return bus;
  });

  let results = [];

  if (date) {
    buses.forEach((bus) => {
      const isUnavailable = bus.unavailableDates?.includes(date);
      const turns = getBusTurnsOnDate(bus, date);
      if (!isUnavailable && turns.length > 0) {
        turns.forEach((turn) => {
          results.push({
            ...bus.toObject(),
            departureTime: turn.departureTime,
            arrivalTime: turn.arrivalTime,
          });
        });
      }
    });
  } else {
    results = buses.map((b) => b.toObject());
  }

  res.json(results);
});

// @desc    Get a single bus by ID (if owned by operator)
// @route   GET /api/operator/buses/:id
// @access  Private (Operator only)
export const getOperatorBusById = asyncHandler(async (req, res) => {
  const operatorId = req.user._id;
  const busId = req.params.id;
  const today = new Date();

  // ✅ Debug print
  console.log(
    "🔍 Operator",
    operatorId.toString(),
    "is requesting bus:",
    busId
  );

  const bus = await Bus.findOne({
    _id: busId,
    operator: operatorId,
  });

  if (!bus) {
    res.status(404);
    throw new Error("Bus not found or not accessible");
  }

  if (
    bus.trendingOffer?.isActive &&
    bus.trendingOffer.expiry &&
    new Date(bus.trendingOffer.expiry) < today
  ) {
    bus.trendingOffer.isActive = false;
  }

  res.json(bus);
});
