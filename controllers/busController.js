import Bus from "../models/Bus.js";
import asyncHandler from "express-async-handler";

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
    // Case 1: The bus is NOT on a rotating schedule.
    if (!bus.rotationSchedule?.isRotating) {
      if (bus.departureTime) {
        const busInstance = bus.toObject();
        busInstance.isRotating = false;
        results.push(busInstance);
      }
      return; // Move to the next bus.
    }

    // Case 2: The bus IS on a rotating schedule.
    const turnsForDay = getScheduledTurnsForDate(bus, date);

    turnsForDay.forEach((turn) => {
      if (turn && turn.departureTime) {
        const busInstance = bus.toObject();
        busInstance.departureTime = turn.departureTime;
        busInstance.arrivalTime = turn.arrivalTime;
        busInstance.isRotating = true;
        results.push(busInstance);
      }
    });
  });

  res.json(results);
});

// --- Your other controller functions ---

export const getBusById = asyncHandler(async (req, res) => {
  const bus = await Bus.findById(req.params.id);
  if (bus) {
    res.json(bus);
  } else {
    res.status(404);
    throw new Error("Bus not found");
  }
});

export const addBus = asyncHandler(async (req, res) => {
  const {
    name,
    from,
    to,
    price,
    seatLayout,
    departureTime,
    arrivalTime,
    busType,
  } = req.body;
  const bus = new Bus({
    name,
    from,
    to,
    price,
    seatLayout,
    departureTime,
    arrivalTime,
    busType,
  });
  const createdBus = await bus.save();
  res.status(201).json(createdBus);
});

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

export const getPaginatedBuses = asyncHandler(async (req, res) => {
  const pageSize = 10;
  const page = Number(req.query.pageNumber) || 1;
  const count = await Bus.countDocuments();
  const buses = await Bus.find({})
    .limit(pageSize)
    .skip(pageSize * (page - 1));
  res.json({ buses, page, pages: Math.ceil(count / pageSize) });
});
