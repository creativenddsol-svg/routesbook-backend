// validators/authValidator.js
import { body } from "express-validator";

export const signupValidator = [
  body("name").trim().escape().notEmpty().withMessage("Name is required"),

  body("email")
    .normalizeEmail()
    .isEmail()
    .withMessage("Valid email is required"),

  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/\d/)
    .withMessage("Password must contain at least one number")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/[\W_]/)
    .withMessage("Password must contain at least one special character"),
];

export const loginValidator = [
  body("email").normalizeEmail().isEmail().withMessage("Enter a valid email"),

  body("password").trim().notEmpty().withMessage("Password is required"),
];
