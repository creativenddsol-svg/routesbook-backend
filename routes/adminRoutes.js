import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
import Booking from "../models/Booking.js";
import Bus from "../models/Bus.js";

const router = express.Router();

// ✅ Admin welcome/test route
router.get("/dashboard", authMiddleware, adminMiddleware, (req, res) => {
  res.json({ message: "Welcome Admin!", user: req.user });
});

// ✅ Get all bookings with filters
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

// ✅ CRUD for buses
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

// ✅ Cancel booking
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

// ✅ Reschedule booking
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

// ✅ Update trending offer for a specific bus
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
