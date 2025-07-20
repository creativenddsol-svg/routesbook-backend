const operatorMiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== "operator") {
    return res.status(403).json({ message: "Access denied: Operator only." });
  }
  next();
};

export default operatorMiddleware;
