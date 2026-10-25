const express = require("express");
const router = express.Router();
const staffController = require("../controllers/staffController");
const { authenticate, authorizeRoles } = require("../middleware/auth");

// All staff routes require authentication
router.use(authenticate);

// GET /api/staff - Lists staff (Agents see active staff; Admins see all staff with permissions)
router.get("/", staffController.listStaff);

// POST /api/staff - Create staff account with specific access permissions (ADMIN only)
router.post("/", authorizeRoles("ADMIN"), staffController.createStaff);

// PATCH /api/staff/:id - Update staff account details, active status, or permissions (ADMIN only)
router.patch("/:id", authorizeRoles("ADMIN"), staffController.updateStaff);

module.exports = router;
