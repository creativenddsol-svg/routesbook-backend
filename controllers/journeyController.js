// controllers/journeyController.js
import Journey from "../models/Journey.js";
import Bus from "../models/Bus.js"; // Needed for populating bus details
import asyncHandler from "../utils/asyncHandler.js";
import mongoose from "mongoose";

// Helper to format date to YYYY-MM-DD
const formatDate = (date) => {
  const d = new Date(date);
  let month = "" + (d.getMonth() + 1);
  let day = "" + d.getDate();
  const year = d.getFullYear();

  if (month.length < 2) month = "0" + month;
  if (day.length < 2) day = "0" + day;

  return [year, month, day].join("-");
};

// @desc    Admin: Create a single journey instance manually
// @route   POST /api/journeys
// This would be used for one-off trips not part of a rotating schedule
export const addJourney = asyncHandler(async (req, res) => {
  const {
    busId,
    journeyDate,
    departureTime,
    arrivalTime,
    price,
    fares,
    boardingPoints,
    droppingPoints,
    unavailableSeats,
  } = req.body;

  const busTemplate = await Bus.findById(busId);
  if (!busTemplate) {
    res.status(404);
    throw new Error("Bus template not found for this journey.");
  }

  // Check if a journey for this bus on this date/time already exists
  const existingJourney = await Journey.findOne({
    bus: busId,
    journeyDate: new Date(journeyDate),
    departureTime: departureTime,
  });

  if (existingJourney) {
    res.status(400);
    throw new Error(
      `A journey for bus ${busTemplate.name} on ${formatDate(
        journeyDate
      )} at ${departureTime} already exists.`
    );
  }

  const newJourney = await Journey.create({
    bus: busId,
    journeyDate: new Date(journeyDate),
    departureTime,
    arrivalTime,
    from: busTemplate.from, // Copy from bus template
    to: busTemplate.to, // Copy from bus template
    busType: busTemplate.busType, // Copy from bus template
    seatLayout: busTemplate.seatLayout, // Copy from bus template
    price: price || busTemplate.price, // Use provided price or bus template's base price
    fares: fares || busTemplate.fares, // Use provided fares or bus template's fares
    boardingPoints: boardingPoints || busTemplate.boardingPoints,
    droppingPoints: droppingPoints || busTemplate.droppingPoints,
    unavailableSeats: unavailableSeats || [],
  });

  res.status(201).json(newJourney);
});

// @desc    Admin: Update a specific journey instance
// @route   PUT /api/journeys/:id
export const updateJourney = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    journeyDate,
    departureTime,
    arrivalTime,
    price,
    fares,
    boardingPoints,
    droppingPoints,
    unavailableSeats,
    isCanceled,
  } = req.body;

  const journey = await Journey.findById(id);

  if (!journey) {
    res.status(404);
    throw new Error("Journey not found.");
  }

  // Update fields
  journey.journeyDate = journeyDate
    ? new Date(journeyDate)
    : journey.journeyDate;
  journey.departureTime = departureTime || journey.departureTime;
  journey.arrivalTime = arrivalTime || journey.arrivalTime;
  journey.price = price || journey.price;
  journey.fares = fares || journey.fares;
  journey.boardingPoints = boardingPoints || journey.boardingPoints;
  journey.droppingPoints = droppingPoints || journey.droppingPoints;
  journey.unavailableSeats = unavailableSeats || journey.unavailableSeats;
  journey.isCanceled =
    isCanceled !== undefined ? isCanceled : journey.isCanceled;

  const updatedJourney = await journey.save();

  res.json(updatedJourney);
});

// @desc    Admin: Delete a specific journey instance
// @route   DELETE /api/journeys/:id
export const deleteJourney = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deletedJourney = await Journey.findByIdAndDelete(id);

  if (!deletedJourney) {
    res.status(404);
    throw new Error("Journey not found.");
  }

  res.json({ message: "Journey deleted successfully." });
});

// @desc    Get all journeys with filters (for public search)
// @route   GET /api/journeys
export const getJourneys = asyncHandler(async (req, res) => {
  const { from, to, date, minPrice, maxPrice, busType } = req.query;

  let query = { isCanceled: false }; // Only show active journeys

  if (date) {
    const searchDate = new Date(date);
    searchDate.setHours(0, 0, 0, 0); // Start of the day
    const nextDay = new Date(searchDate);
    nextDay.setDate(searchDate.getDate() + 1); // End of the day
    query.journeyDate = { $gte: searchDate, $lt: nextDay };
  } else {
    // If no date is provided, only show journeys from today onwards
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    query.journeyDate = { $gte: today };
  }

  if (from) {
    query.from = new RegExp(from, "i");
  }
  if (to) {
    query.to = new RegExp(to, "i");
  }
  if (busType) {
    query.busType = busType;
  }
  if (minPrice) {
    query.price = { ...query.price, $gte: Number(minPrice) };
  }
  if (maxPrice) {
    query.price = { ...query.price, $lte: Number(maxPrice) };
  }

  const journeys = await Journey.find(query)
    .populate("bus", "name operatorLogo features trendingOffer") // Populate relevant bus template details
    .sort({ departureTime: 1 }); // Sort by departure time for better display

  // Filter out buses where trending offer has expired
  const today = new Date();
  const filteredJourneys = journeys.filter((journey) => {
    if (
      journey.bus?.trendingOffer?.isActive &&
      journey.bus.trendingOffer.expiry
    ) {
      return new Date(journey.bus.trendingOffer.expiry) >= today;
    }
    return true; // Keep if no trending offer or if it's active and not expired
  });

  res.json(filteredJourneys);
});

// @desc    Get a single journey by ID
// @route   GET /api/journeys/:id
export const getJourneyById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const journey = await Journey.findById(id).populate(
    "bus",
    "name operatorLogo features trendingOffer"
  ); // Populate bus template details

  if (!journey) {
    res.status(404);
    throw new Error("Journey not found.");
  }

  // Ensure trending offer is active
  const today = new Date();
  if (
    journey.bus?.trendingOffer?.isActive &&
    journey.bus.trendingOffer.expiry &&
    new Date(journey.bus.trendingOffer.expiry) < today
  ) {
    journey.bus.trendingOffer.isActive = false; // Mark as inactive for this response
  }

  res.json(journey);
});

// @desc    Get paginated list of all journeys (for admin panel)
// @route   GET /api/journeys/paginated
export const getPaginatedJourneys = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, busId, journeyDate, from, to } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  let query = {};
  if (busId) query.bus = busId;
  if (journeyDate) {
    const searchDate = new Date(journeyDate);
    searchDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(searchDate);
    nextDay.setDate(searchDate.getDate() + 1);
    query.journeyDate = { $gte: searchDate, $lt: nextDay };
  }
  if (from) query.from = new RegExp(from, "i");
  if (to) query.to = new RegExp(to, "i");

  const total = await Journey.countDocuments(query);
  const journeys = await Journey.find(query)
    .populate("bus", "name operatorLogo") // Only get essential bus info
    .sort({ journeyDate: -1, departureTime: 1 }) // Sort by latest date first, then time
    .skip(skip)
    .limit(Number(limit));

  res.json({
    journeys,
    totalPages: Math.ceil(total / Number(limit)),
    currentPage: Number(page),
    totalCount: total,
  });
});
