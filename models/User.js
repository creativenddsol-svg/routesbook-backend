// models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

/* ──────────────────────────────────────────────────────────
   Operator-specific sub-schema (only populated when role is “operator”)
────────────────────────────────────────────────────────── */
const operatorProfileSchema = new mongoose.Schema(
  {
    businessName: { type: String, trim: true },
    logo: { type: String }, // URL for logo image
    contactNumber: { type: String },
    address: { type: String },
    website: { type: String },

    payoutMethod: {
      bankName: String,
      accountNumber: String,
      accountHolder: String,
      payoutFrequency: {
        type: String,
        enum: ["daily", "weekly", "monthly"],
        default: "monthly",
      },
    },
  },
  { _id: false } // do not create separate _id for the sub-document
);

/* ──────────────────────────────────────────────────────────
   Main User schema
────────────────────────────────────────────────────────── */
const userSchema = new mongoose.Schema(
  {
    /* ― Basic User Information ― */
    fullName: {
      type: String,
      required: [true, "Full name is required."],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/\S+@\S+\.\S+/, "Please use a valid email address."],
    },
    mobile: String,
    nic: {
      type: String,
      unique: true,
      sparse: true, // allow multiple nulls, enforce uniqueness on non-null
    },
    profilePicture: {
      type: String, // URL
      default: "",
    },
    password: {
      type: String,
      required: [true, "Password is required."],
      minlength: [6, "Password must be at least 6 characters long."],
    },

    /* ― Role & Status ― */
    role: {
      type: String,
      enum: ["user", "admin", "operator"],
      default: "user",
    },
    isActive: { type: Boolean, default: true },
    lastLogin: Date,

    /* ― Password Reset ― */
    resetPasswordToken: String,
    resetPasswordExpires: Date,

    /* ― Operator Profile (optional) ― */
    operatorProfile: operatorProfileSchema,
  },
  { timestamps: true }
);

/* ──────────────────────────────────────────────────────────
   Hooks
────────────────────────────────────────────────────────── */
// Hash password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/* ──────────────────────────────────────────────────────────
   Instance methods
────────────────────────────────────────────────────────── */
userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

/* ──────────────────────────────────────────────────────────
   Model export
────────────────────────────────────────────────────────── */
const User = mongoose.model("User", userSchema);
export default User;
