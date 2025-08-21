import Bus from "../models/Bus.js";
import asyncHandler from "express-async-handler";

/**
 * A helper function to determine the scheduled departure/arrival turns for a specific date
 * if the bus is on a rotating schedule.
 * @param {object} bus - The bus object from the database.
 * @param {string} date - The date for which to find the schedule (e.g., "2025-08-03").
 * @returns {Array} - An array of scheduled turns for that day, or an empty array if none.
 */
const getScheduledTurnsForDate = (bus, date) => {
  if (!bus?.rotationSchedule?.isRotating || !date) {
    return [];
  }
  const { startDate, rotationLength, intervals } = bus.rotationSchedule;
  if (!startDate || !rotationLength || !intervals) {
    return [];
  }
  const bookingDate = new Date(date);
  const rotationStartDate = new Date(startDate);
  if (isNaN(bookingDate.getTime()) || isNaN(rotationStartDate.getTime())) {
    return [];
  }
  const timeDiff =
    bookingDate.setHours(0, 0, 0, 0) - rotationStartDate.setHours(0, 0, 0, 0);
  if (timeDiff < 0) {
    return [];
  }
  const dayDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  const dayOffset = dayDiff % rotationLength;
  const daySchedule = intervals.find((i) => i.dayOffset === dayOffset);
  if (daySchedule?.turns?.length > 0) {
    return daySchedule.turns;
  }
  return [];
};

/**
 * Fetches buses based on query parameters (from, to, date).
 */
export const getBuses = asyncHandler(async (req, res) => {
  const { from, to, date } = req.query;
  const query = {};
  if (from) query.from = from;
  if (to) query.to = to;
  const buses = await Bus.find(query);
  if (!date) {
    return res.json(buses);
  }
  const results = [];
  buses.forEach((bus) => {
    if (!bus.rotationSchedule?.isRotating) {
      if (bus.departureTime) {
        const busInstance = bus.toObject();
        busInstance.isRotating = false;
        results.push(busInstance);
      }
      return;
    }
    const turnsForDay = getScheduledTurnsForDate(bus, date);
    turnsForDay.forEach((turn) => {
      if (turn && turn.departureTime) {
        const busInstance = bus.toObject();
        busInstance.departureTime = turn.departureTime;
        busInstance.arrivalTime = turn.arrivalTime;
        busInstance.boardingPoints = turn.boardingPoints || [];
        busInstance.droppingPoints = turn.droppingPoints || [];
        busInstance.isRotating = true;
        results.push(busInstance);
      }
    });
  });
  res.json(results);
});

/**
 * Fetches a single bus by its ID.
 */
export const getBusById = asyncHandler(async (req, res) => {
  const bus = await Bus.findById(req.params.id);
  if (bus) {
    res.json(bus);
  } else {
    res.status(404);
    throw new Error("Bus not found");
  }
});

/**
 * === UPDATED: Fetches all buses that have an active and non-expired trending offer. ===
 * This logic has been consolidated here from your busRoutes.js file.
 */
export const getTrendingBuses = asyncHandler(async (req, res) => {
  const today = new Date();
  const trendingBuses = await Bus.find({
    "trendingOffer.isActive": true,
    "trendingOffer.expiry": { $gte: today }, // Also check if the offer has expired
  }).limit(6); // Limit to 6 results

  if (trendingBuses) {
    res.json(trendingBuses);
  } else {
    res.status(404).json({ message: "No trending offers found." });
  }
});

/**
 * === NEW: The function to properly update a trending offer. ===
 */
export const updateTrendingOffer = asyncHandler(async (req, res) => {
  const { trendingOffer } = req.body;
  const bus = await Bus.findById(req.params.id);

  if (bus) {
    // Directly assign the new trendingOffer object from the request.
    // This is the correct way to update the nested document.
    bus.trendingOffer = trendingOffer;

    const updatedBus = await bus.save();
    res.status(200).json(updatedBus);
  } else {
    res.status(404);
    throw new Error("Bus not found");
  }
});

/**
 * Adds a new bus to the database.
 */
export const addBus = asyncHandler(async (req, res) => {
  const {
    name,
    from,
    to,
    date,
    departureTime,
    arrivalTime,
    busType,
    seatLayout,
    price,
    operatorLogo,
    unavailableDates,
    isAvailable,
    operator,
    features,
    trendingOffer,
    convenienceFee,
    rotationSchedule,
    boardingPoints,
    droppingPoints,
    fares,
  } = req.body;
  const bus = new Bus({
    name,
    from,
    to,
    date,
    departureTime,
    arrivalTime,
    busType,
    seatLayout,
    price,
    operatorLogo,
    unavailableDates,
    isAvailable,
    operator,
    features,
    trendingOffer,
    convenienceFee,
    rotationSchedule,
    boardingPoints,
    droppingPoints,
    fares,
  });
  const createdBus = await bus.save();
  res.status(201).json(createdBus);
});

/**
 * Updates an existing bus by its ID.
 */
export const updateBus = asyncHandler(async (req, res) => {
  const bus = await Bus.findById(req.params.id);
  if (bus) {
    Object.assign(bus, req.body);
    const updatedBus = await bus.save();
    res.json(updatedBus);
  } else {
    res.status(404);
    throw new Error("Bus not found");
  }
});

/**
 * Deletes a bus by its ID.
 */
export const deleteBus = asyncHandler(async (req, res) => {
  const bus = await Bus.findById(req.params.id);
  if (bus) {
    await bus.deleteOne();
    res.json({ message: "Bus removed" });
  } else {
    res.status(404);
    throw new Error("Bus not found");
  }
});

/**
 * Fetches buses with pagination.
 */
export const getPaginatedBuses = asyncHandler(async (req, res) => {
  const pageSize = 10;
  const page = Number(req.query.pageNumber) || 1;
  const count = await Bus.countDocuments();
  const buses = await Bus.find({})
    .limit(pageSize)
    .skip(pageSize * (page - 1));
  res.json({ buses, page, pages: Math.ceil(count / pageSize) });
});
