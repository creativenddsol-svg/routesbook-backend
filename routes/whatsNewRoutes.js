// routes/whatsNewRoutes.js
import express from "express";
import {
  createItem,
  getAll,
  getActive,
  updateItem,
  deleteItem,
} from "../controllers/whatsNewController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";

const router = express.Router();

/* Admin-only */
router.post("/", authMiddleware, adminMiddleware, createItem);
router.get("/", authMiddleware, adminMiddleware, getAll);
router.put("/:id", authMiddleware, adminMiddleware, updateItem);
router.delete("/:id", authMiddleware, adminMiddleware, deleteItem);

/* Public */
router.get("/active", getActive);

export default router;
