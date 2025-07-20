import express from "express";
import Bus from "../models/Bus.js";
import mongoose from "mongoose";

const router = express.Router();

// ⚠️ TEMP: Assign all unassigned buses to a test operator
router.post("/assign-test-operator", async (req, res) => {
  const { operatorId } = req.body;

  if (!operatorId) {
    return res.status(400).json({ message: "Missing operatorId" });
  }

  try {
    const result = await Bus.updateMany(
      { operator: { $exists: false } }, // Only update buses without operator
      { $set: { operator: new mongoose.Types.ObjectId(operatorId) } }
    );

    res.json({
      message: `✅ Updated ${result.modifiedCount} buses`,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to update buses", error: err });
  }
});

export default router;
