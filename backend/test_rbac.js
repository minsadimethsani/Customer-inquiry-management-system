const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");
const { authenticate } = require("./src/middleware/auth");

// Mock environment for RBAC test
process.env.JWT_SECRET = "rbac_test_jwt_secret_key_123";
process.env.NODE_ENV = "test";

// Mock database storage
const mockInquiries = [
  {
    id: "inq-1",
    ticketNumber: "INQ-1001",
    subject: "HVAC System Breakdown",
    status: "OPEN",
    priority: "URGENT",
    assignedToId: null, // Unassigned general inquiry
    createdById: "staff-1",
  },
  {
    id: "inq-2",
    ticketNumber: "INQ-1002",
    subject: "Billing Discrepancy",
    status: "IN_PROGRESS",
    priority: "HIGH",
    assignedToId: "staff-1", // Assigned directly to staff-1
    createdById: "staff-1",
  },
  {
    id: "inq-3",
    ticketNumber: "INQ-1003",
    subject: "Server Outage in Building B",
    status: "IN_PROGRESS",
    priority: "URGENT",
    assignedToId: "staff-2", // Assigned to staff-2
    createdById: "staff-2",
  },
  {
    id: "inq-4",
    ticketNumber: "INQ-1004",
    subject: "Closed Equipment Inquiry",
    status: "CLOSED",
    priority: "LOW",
    assignedToId: null, // Unassigned and CLOSED
    createdById: "staff-2",
  },
];

async function runRBACTests() {
  console.log("=========================================");
  console.log("🧪 TESTING BACKEND RBAC & RECORD OWNERSHIP");
  console.log("=========================================\n");

  const app = express();
  app.use(express.json());

  // In-memory mock route mirroring inquiryController's RBAC logic
  app.get("/api/inquiries", authenticate, (req, res) => {
    const isAdmin = req.user?.role === "ADMIN";
    let records = [...mockInquiries];

    if (!isAdmin) {
      // Staff can view all general inquiries (unassigned) or specifically assigned inquiries
      records = records.filter(
        (inq) =>
          inq.assignedToId === req.user?.id ||
          inq.assignedToId === null ||
          inq.createdById === req.user?.id
      );
    }

    res.json({ data: records, total: records.length });
  });

  const handleUpdate = (req, res) => {
    const { id } = req.params;
    const existing = mockInquiries.find((i) => i.id === id);

    if (!existing) {
      return res.status(404).json({ error: "Not Found" });
    }

    // RBAC: Admin can update all inquiries.
    // Staff can only update inquiries assigned directly to them, or inquiries in 'OPEN' status.
    const isAdmin = req.user?.role === "ADMIN";
    const isAssigned = Boolean(req.user?.id && existing.assignedToId === req.user.id);
    const isOpen = existing.status === "OPEN";

    if (!isAdmin) {
      if (existing.assignedToId && existing.assignedToId !== req.user?.id) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You are not authorized to update this inquiry. It is assigned to another staff member.",
        });
      }

      if (!isAssigned && !isOpen) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You are not authorized to update this inquiry. Staff can only update inquiries assigned directly to them or inquiries in OPEN status.",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Inquiry updated successfully",
      inquiry: { ...existing, ...req.body },
    });
  };

  app.put("/api/inquiries/:id", authenticate, handleUpdate);
  app.patch("/api/inquiries/:id", authenticate, handleUpdate);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  async function request(path, options = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  }

  // Tokens
  const adminToken = jwt.sign(
    { id: "admin-1", email: "admin@example.com", role: "ADMIN" },
    process.env.JWT_SECRET
  );
  const staff1Token = jwt.sign(
    { id: "staff-1", email: "staff1@services.com", role: "AGENT" },
    process.env.JWT_SECRET
  );
  const staff2Token = jwt.sign(
    { id: "staff-2", email: "staff2@services.com", role: "AGENT" },
    process.env.JWT_SECRET
  );

  try {
    // 1. GET /api/inquiries RBAC Filtering
    console.log("1. GET /api/inquiries RBAC Filtering:");

    const adminList = await request("/api/inquiries", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminList.status === 200, "ADMIN receives 200 OK");
    assert(
      adminList.body.data.length === 4,
      "ADMIN views ALL 4 inquiries across the system"
    );

    const staff1List = await request("/api/inquiries", {
      headers: { Authorization: `Bearer ${staff1Token}` },
    });
    assert(staff1List.status === 200, "Staff receives 200 OK");
    const staff1HasStaff2Assigned = staff1List.body.data.some(
      (i) => i.id === "inq-3"
    );
    assert(
      !staff1HasStaff2Assigned,
      "Staff-1 cannot see inquiry inq-3 assigned to Staff-2"
    );
    assert(
      staff1List.body.data.some((i) => i.id === "inq-1"),
      "Staff-1 can see general/unassigned inquiry inq-1"
    );
    assert(
      staff1List.body.data.some((i) => i.id === "inq-2"),
      "Staff-1 can see inquiry inq-2 specifically assigned to them"
    );

    // 2. PUT & PATCH /api/inquiries/:id RBAC Enforcement
    console.log("\n2. PUT /api/inquiries/:id & PATCH Enforcement:");

    // Staff-1 attempts to update inq-3 assigned to Staff-2 -> 403 Forbidden
    const staff1UpdateStaff2InquiryPut = await request("/api/inquiries/inq-3", {
      method: "PUT",
      headers: { Authorization: `Bearer ${staff1Token}` },
      body: JSON.stringify({ status: "RESOLVED" }),
    });
    assert(
      staff1UpdateStaff2InquiryPut.status === 403,
      "PUT by staff on another staff's inquiry returns 403 Forbidden"
    );
    assert(
      staff1UpdateStaff2InquiryPut.body.error === "Forbidden",
      "Error returned is 'Forbidden'"
    );

    const staff1UpdateStaff2InquiryPatch = await request("/api/inquiries/inq-3", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${staff1Token}` },
      body: JSON.stringify({ status: "RESOLVED" }),
    });
    assert(
      staff1UpdateStaff2InquiryPatch.status === 403,
      "PATCH by staff on another staff's inquiry returns 403 Forbidden"
    );

    // Staff-1 updates inquiry assigned directly to them (inq-2) -> 200 OK
    const staff1UpdateOwnInquiry = await request("/api/inquiries/inq-2", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${staff1Token}` },
      body: JSON.stringify({ status: "RESOLVED" }),
    });
    assert(
      staff1UpdateOwnInquiry.status === 200,
      "Staff-1 updating inquiry directly assigned to them returns 200 OK"
    );

    // Staff-1 updates general inquiry in 'OPEN' status (inq-1) -> 200 OK
    const staff1UpdateOpenInquiry = await request("/api/inquiries/inq-1", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${staff1Token}` },
      body: JSON.stringify({ status: "IN_PROGRESS", assignedToId: "staff-1" }),
    });
    assert(
      staff1UpdateOpenInquiry.status === 200,
      "Staff-1 claiming/updating unassigned inquiry in OPEN status returns 200 OK"
    );

    // Staff-1 updates unassigned inquiry in 'CLOSED' status (inq-4) -> 403 Forbidden
    const staff1UpdateClosedInquiry = await request("/api/inquiries/inq-4", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${staff1Token}` },
      body: JSON.stringify({ priority: "HIGH" }),
    });
    assert(
      staff1UpdateClosedInquiry.status === 403,
      "Staff-1 updating unassigned inquiry in CLOSED status returns 403 Forbidden"
    );

    // ADMIN updates inquiry inq-3 assigned to Staff-2 -> 200 OK
    const adminUpdateStaff2Inquiry = await request("/api/inquiries/inq-3", {
      method: "PUT",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: "RESOLVED" }),
    });
    assert(
      adminUpdateStaff2Inquiry.status === 200,
      "ADMIN updating any customer inquiry returns 200 OK"
    );

    console.log("\n=========================================");
    console.log(`📊 RBAC TESTS COMPLETED: ${passed} passed, ${failed} failed`);
    console.log("=========================================\n");

    if (failed > 0) process.exit(1);
  } finally {
    server.close();
  }
}

runRBACTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
