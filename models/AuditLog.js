// In models/AuditLog.js
import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    // ... other fields ...
    action: {
      type: String,
      required: true,
      enum: [
        "LOGIN",
        "BOOK",
        "CANCEL",
        "PROFILE_UPDATE",
        // ✅ CONFIRM THESE ARE PRESENT AND SPELLED CORRECTLY:
        "BOOKING_CREATED",
        "BOOKING_CANCELLED",
      ],
    },
    // ... other fields ...
  },
  {
    timestamps: true,
  }
);

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
