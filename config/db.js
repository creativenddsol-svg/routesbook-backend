import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ MongoDB connected");
    console.log("🔗 Host:", conn.connection.host);
    console.log("🗃️  Database Name:", conn.connection.name);
    console.log("📚 Collections:", Object.keys(conn.models).join(", "));
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1); // Exit with failure
  }
};

export default connectDB;
