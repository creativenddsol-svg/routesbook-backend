import mongoose from "mongoose";
import dotenv from "dotenv";
import Bus from "./models/Bus.js";
import User from "./models/User.js";

dotenv.config();

const fixOperators = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  const buses = await Bus.find({});
  let updatedCount = 0;

  for (const bus of buses) {
    if (bus.operator && typeof bus.operator === "string") {
      const matchedUser = await User.findOne({ email: bus.operator });
      if (matchedUser) {
        bus.operator = matchedUser._id;
        await bus.save();
        updatedCount++;
        console.log(`✅ Fixed bus: ${bus.name}`);
      }
    }
  }

  console.log(`🎉 Done. Total buses updated: ${updatedCount}`);
  mongoose.disconnect();
};

fixOperators();
