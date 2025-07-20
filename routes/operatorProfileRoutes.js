// routes/operatorProfileRoutes.js
import express from "express";
import {
  getOperatorProfile,
  updateOperatorProfile,
} from "../controllers/operatorProfileController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

/* -----------------------------------------------------------
   Simple inline middleware to ensure the user’s role is 'operator'
------------------------------------------------------------ */
const operatorMiddleware = (req, res, next) => {
  if (req.user?.role !== "operator") {
    return res
      .status(403)
      .json({ message: "Access denied: operator account required" });
  }
  next();
};

/* -----------------------------------------------------------
   /api/operator-profile/me
------------------------------------------------------------ */
router
  .route("/me")
  .get(authMiddleware, operatorMiddleware, getOperatorProfile)
  .put(authMiddleware, operatorMiddleware, updateOperatorProfile);

export default router;
