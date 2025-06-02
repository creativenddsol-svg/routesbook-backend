import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: ["LOGIN", "BOOK", "CANCEL", "PROFILE_UPDATE"],
    },
    details: {
      type: Object, // any relevant info (e.g. busId, seat number)
    },
  },
  {
    timestamps: true, // includes createdAt
  }
);

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
