import jwt from "jsonwebtoken";
import User from "../models/User.js";

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("🔒 AuthMiddleware: No Bearer token provided.");
    return res
      .status(401)
      .json({ message: "Not authorized, no token provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("✅ AuthMiddleware: Token decoded:", decoded);

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      console.log("❌ AuthMiddleware: User not found in DB.");
      return res
        .status(401)
        .json({ message: "Not authorized, user not found." });
    }

    req.user = user;
    req.token = token; // Optional: for downstream logging/debugging

    console.log(
      `✅ AuthMiddleware: User ${user.email} authenticated. Role: ${user.role}`
    );
    next();
  } catch (err) {
    console.error("❌ AuthMiddleware Error:", err.message);
    return res.status(401).json({ message: "Not authorized, token failed." });
  }
};

export default authMiddleware;
