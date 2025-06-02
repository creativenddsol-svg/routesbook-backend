import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  fullName: { type: String },
  email: { type: String, required: true, unique: true },
  mobile: { type: String },
  nic: { type: String },
  profilePicture: { type: String }, // optional
  password: { type: String, required: true },
  role: { type: String, enum: ["user", "admin"], default: "user" },

  // ✅ For password reset
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
});

// ✅ Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

export default mongoose.model("User", userSchema);
