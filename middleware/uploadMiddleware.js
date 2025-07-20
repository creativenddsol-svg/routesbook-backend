// middleware/uploadMiddleware.js
import multer from "multer";
import path from "path";

// Set storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/specialNotices"); // Save under this folder
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

// File filter (accept only images)
const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/;
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

const upload = multer({ storage, fileFilter });

export default upload;
