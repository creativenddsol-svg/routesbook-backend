import Bus from "../models/Bus.js";
import asyncHandler from "../utils/asyncHandler.js";

// @desc    Add new bus (Admin only)
// @route   POST /api/buses
export const addBus = asyncHandler(async (req, res) => {
  const newBus = await Bus.create(req.body);
  res.status(201).json(newBus);
});

// @desc    Update bus by ID
// @route   PUT /api/buses/:id
export const updateBus = asyncHandler(async (req, res) => {
  const updatedBus = await Bus.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });

  if (!updatedBus) {
    res.status(404);
    throw new Error("Bus not found");
  }

  res.json(updatedBus);
});

// @desc    Delete bus by ID
// @route   DELETE /api/buses/:id
export const deleteBus = asyncHandler(async (req, res) => {
  const deletedBus = await Bus.findByIdAndDelete(req.params.id);

  if (!deletedBus) {
    res.status(404);
    throw new Error("Bus not found");
  }

  res.json({ message: "Bus deleted" });
});

// @desc    Get all buses with optional filters
// @route   GET /api/buses
export const getBuses = asyncHandler(async (req, res) => {
  const { from, to, date } = req.query;
  const today = new Date();

  let buses = await Bus.find();

  // Auto-disable expired trending offers
  buses = buses.map((bus) => {
    if (
      bus.trendingOffer?.isActive &&
      new Date(bus.trendingOffer.expiry) < today
    ) {
      bus.trendingOffer.isActive = false;
    }
    return bus;
  });

  // Filter results
  if (from) {
    buses = buses.filter((b) =>
      b.from.toLowerCase().includes(from.trim().toLowerCase())
    );
  }

  if (to) {
    buses = buses.filter((b) =>
      b.to.toLowerCase().includes(to.trim().toLowerCase())
    );
  }

  if (date) {
    buses = buses.filter((b) => !b.unavailableDates?.includes(date));
  }

  res.json(buses);
});

// @desc    Get paginated bus list with optional filters
// @route   GET /api/buses/paginated
export const getPaginatedBuses = asyncHandler(async (req, res) => {
  const { from, to, date, page = 1, limit = 6 } = req.query;
  const query = {};

  if (from) query.from = new RegExp(from, "i");
  if (to) query.to = new RegExp(to, "i");

  const allBuses = await Bus.find(query);
  const filteredBuses = date
    ? allBuses.filter((b) => !b.unavailableDates?.includes(date))
    : allBuses;

  const total = filteredBuses.length;
  const skip = (page - 1) * limit;
  const buses = filteredBuses.slice(skip, skip + Number(limit));

  res.json({
    buses,
    totalPages: Math.ceil(total / limit),
    currentPage: Number(page),
  });
});
