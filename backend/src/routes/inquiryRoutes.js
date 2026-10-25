const express = require("express");
const router = express.Router();
const { authenticate, authorizeRoles } = require("../middleware/auth");
const {
  listInquiries,
  getInquiry,
  createInquiry,
  updateInquiry,
  deleteInquiry,
  addMessage,
  getStats,
} = require("../controllers/inquiryController");

// All inquiry routes require authentication
router.use(authenticate);

// ─── Stats (must be declared before /:id to avoid route conflict) ────────────
router.get("/stats", getStats);

// ─── Core CRUD ───────────────────────────────────────────────────────────────

/**
 * GET    /api/inquiries          — list with filters + pagination
 * POST   /api/inquiries          — create new inquiry (any authenticated staff)
 */
router.get("/", listInquiries);
router.post("/", createInquiry);

/**
 * GET    /api/inquiries/:id      — full inquiry detail (messages + activity log)
 * PATCH  /api/inquiries/:id      — update any field; logs diffs automatically
 * DELETE /api/inquiries/:id      — soft-close (all staff) | hard-delete (ADMIN only, ?hardDelete=true)
 */
router.get("/:id", getInquiry);
router.patch("/:id", updateInquiry);
router.put("/:id", updateInquiry);
router.delete("/:id", deleteInquiry);

// ─── Nested: Messages / Internal Notes ───────────────────────────────────────

/**
 * POST /api/inquiries/:id/messages
 * Body: { body: string, isInternalNote?: boolean }
 */
router.post("/:id/messages", addMessage);

module.exports = router;
