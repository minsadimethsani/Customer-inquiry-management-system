const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");

// Public route: Staff login
router.post("/login", authController.login);

// Protected route: Current authenticated staff profile
router.get("/me", authenticate, authController.getMe);

module.exports = router;
