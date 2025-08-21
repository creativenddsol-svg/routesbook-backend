import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
import asyncHandler from "express-async-handler";

import Booking from "../models/Booking.js";
import Bus from "../models/Bus.js";
import User from "../models/User.js";
import { registerOperator } from "../controllers/adminOperatorController.js"; // ✅ NEW

const router = express.Router();

/* ─────────────────────────────────────────────────────────
   Admin dashboard
────────────────────────────────────────────────────────── */
router.get("/dashboard", authMiddleware, adminMiddleware, (req, res) => {
  res.json({ message: "Welcome Admin!", user: req.user });
});

/* ✅ Admin token test route (optional) */
router.get("/test-admin", authMiddleware, adminMiddleware, (req, res) => {
  res.json({
    message: "✅ You are authenticated as Admin!",
    user: req.user,
  });
});

/* ─────────────────────────────────────────────────────────
   Operators – list & create
────────────────────────────────────────────────────────── */
router.get(
  "/operators",
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const operators = await User.find({ role: "operator" }).select(
      "_id fullName email"
    );
    res.json(operators);
  })
);

// ✅ NEW: create/register operator
router.post(
  "/operators/register",
  authMiddleware,
  adminMiddleware,
  registerOperator
);

/* ─────────────────────────────────────────────────────────
   Bookings
────────────────────────────────────────────────────────── */
router.get("/bookings", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { date, from, to, userEmail } = req.query;
    let bookings = await Booking.find(date ? { date } : {})
      .populate("user", "name email")
      .populate("bus");

    bookings = bookings.filter((b) => {
      const matchFrom = from
        ? b.bus?.from?.toLowerCase().includes(from.toLowerCase())
        : true;
      const matchTo = to
        ? b.bus?.to?.toLowerCase().includes(to.toLowerCase())
        : true;
      const matchEmail = userEmail
        ? b.user?.email?.toLowerCase().includes(userEmail.toLowerCase())
        : true;
      return matchFrom && matchTo && matchEmail;
    });

    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ─────────────────────────────────────────────────────────
   Buses (CRUD)
────────────────────────────────────────────────────────── */
router.post("/buses", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const bus = await Bus.create(req.body);
    res.status(201).json(bus);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/buses/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const updatedBus = await Bus.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json(updatedBus);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete(
  "/buses/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      await Bus.findByIdAndDelete(req.params.id);
      res.json({ message: "Bus deleted successfully" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

/* ─────────────────────────────────────────────────────────
   Booking cancel / reschedule
────────────────────────────────────────────────────────── */
router.delete(
  "/bookings/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      await Booking.findByIdAndDelete(req.params.id);
      res.json({ message: "Booking cancelled successfully" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

router.put(
  "/bookings/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    const { date, selectedSeats } = req.body;

    try {
      const booking = await Booking.findById(req.params.id);
      if (!booking)
        return res.status(404).json({ message: "Booking not found" });

      const conflict = await Booking.findOne({
        _id: { $ne: booking._id },
        bus: booking.bus,
        date,
        selectedSeats: { $in: selectedSeats },
      });

      if (conflict) {
        return res
          .status(400)
          .json({ message: "Some selected seats are already booked" });
      }

      booking.date = date;
      booking.selectedSeats = selectedSeats;
      await booking.save();

      res.json({ message: "Booking rescheduled successfully", booking });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

/* ─────────────────────────────────────────────────────────
   Trending offers
────────────────────────────────────────────────────────── */
router.put(
  "/buses/:id/trending-offer",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { isActive, discountPercent, message, expiry } = req.body;
      const bus = await Bus.findById(req.params.id);
      if (!bus) return res.status(404).json({ message: "Bus not found" });

      bus.trendingOffer = { isActive, discountPercent, message, expiry };
      await bus.save();

      res.status(200).json({ message: "Trending offer updated", bus });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

export default router;
