const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");
const { authenticate } = require("./src/middleware/auth");

process.env.JWT_SECRET = "workflow_test_secret_123";
process.env.NODE_ENV = "test";

const ALLOWED_STATUS_TRANSITIONS = {
  OPEN: ["IN_PROGRESS"],
  IN_PROGRESS: ["PENDING_CUSTOMER", "RESOLVED"],
  PENDING_CUSTOMER: ["IN_PROGRESS", "RESOLVED"],
  RESOLVED: ["IN_PROGRESS", "CLOSED"],
  CLOSED: [],
};

// In-memory mock database
let inquiriesDb = [
  {
    id: "inq-101",
    ticketNumber: "INQ-1001",
    subject: "Water leak in server room",
    description: "Urgent leak reported",
    customerName: "Alice Smith",
    customerEmail: "alice@example.com",
    status: "OPEN",
    priority: "URGENT",
    assignedToId: "staff-1",
    createdAt: new Date(),
  },
  {
    id: "inq-102",
    ticketNumber: "INQ-1002",
    subject: "Printer configuration issue",
    description: "Needs network setup",
    customerName: "Bob Jones",
    customerEmail: "bob@example.com",
    status: "IN_PROGRESS",
    priority: "LOW",
    assignedToId: "staff-1",
    createdAt: new Date(),
  },
  {
    id: "inq-103",
    ticketNumber: "INQ-1003",
    subject: "Billing charge dispute",
    description: "Refund inquiry",
    customerName: "Charlie Brown",
    customerEmail: "charlie@example.com",
    status: "RESOLVED",
    priority: "MEDIUM",
    assignedToId: "staff-1",
    createdAt: new Date(),
  },
  {
    id: "inq-104",
    ticketNumber: "INQ-1004",
    subject: "Archived annual audit",
    description: "Completed audit ticket",
    customerName: "Diana Prince",
    customerEmail: "diana@example.com",
    status: "CLOSED",
    priority: "LOW",
    assignedToId: "staff-1",
    createdAt: new Date(Date.now() - 3600 * 1000),
  },
];

async function runWorkflowTests() {
  console.log("=================================================");
  console.log("🧪 TESTING WORKFLOW RULES, VALIDATION & DUPLICATE");
  console.log("=================================================\n");

  const app = express();
  app.use(express.json());

  // POST /api/inquiries
  app.post("/api/inquiries", authenticate, (req, res) => {
    const { subject, description, customerName, customerEmail } = req.body;

    const errors = {};
    if (!subject || !subject.trim()) errors.subject = "Subject is required.";
    if (!description || !description.trim()) errors.description = "Description is required.";
    if (!customerName || !customerName.trim()) errors.customerName = "Customer name is required.";
    if (!customerEmail || !customerEmail.trim()) {
      errors.customerEmail = "Customer email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
      errors.customerEmail = "Customer email is not a valid email address.";
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        error: "Validation Error",
        message: Object.values(errors)[0],
        details: errors,
      });
    }

    // Duplicate check within 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingDuplicate = inquiriesDb.find(
      (i) =>
        i.customerEmail.toLowerCase() === customerEmail.trim().toLowerCase() &&
        i.subject.toLowerCase() === subject.trim().toLowerCase() &&
        new Date(i.createdAt) >= fiveMinutesAgo
    );

    if (existingDuplicate) {
      return res.status(409).json({
        success: false,
        error: "Conflict",
        message:
          "A duplicate inquiry with this subject from this customer was already submitted within the last 5 minutes.",
        data: existingDuplicate,
      });
    }

    const newInquiry = {
      id: `inq-${Date.now()}`,
      ticketNumber: `INQ-${1000 + inquiriesDb.length + 1}`,
      subject: subject.trim(),
      description: description.trim(),
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim().toLowerCase(),
      status: "OPEN",
      priority: req.body.priority || "MEDIUM",
      assignedToId: req.body.assignedToId || null,
      createdAt: new Date(),
    };
    inquiriesDb.push(newInquiry);

    return res.status(201).json({
      success: true,
      message: "Inquiry created successfully.",
      data: newInquiry,
    });
  });

  // PATCH /api/inquiries/:id
  app.patch("/api/inquiries/:id", authenticate, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const existing = inquiriesDb.find((i) => i.id === id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: `Inquiry with id '${id}' does not exist.`,
      });
    }

    // Rule 1: Closed records are final
    if (existing.status === "CLOSED") {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Inquiry is CLOSED. Closed inquiries are final and cannot be modified or reopened.",
      });
    }

    // Rule 2: State transition enforcement
    if (status !== undefined && status !== existing.status) {
      const allowedNext = ALLOWED_STATUS_TRANSITIONS[existing.status] || [];
      if (!allowedNext.includes(status)) {
        return res.status(400).json({
          success: false,
          error: "Bad Request",
          message: `Invalid status transition from '${existing.status}' to '${status}'. Allowed transitions: ${allowedNext.join(", ")}.`,
        });
      }
      existing.status = status;
    }

    return res.status(200).json({
      success: true,
      message: "Inquiry updated successfully.",
      data: existing,
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: "Not Found",
      message: `Cannot ${req.method} ${req.originalUrl}`,
    });
  });

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

  const token = jwt.sign(
    { id: "staff-1", email: "staff1@services.com", role: "AGENT" },
    process.env.JWT_SECRET
  );
  const authHeaders = { Authorization: `Bearer ${token}` };

  try {
    // 1. State Transition Rules
    console.log("1. Workflow State Transition Rules:");

    // Invalid: OPEN -> CLOSED (leap without resolution)
    const openToClosed = await request("/api/inquiries/inq-101", {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ status: "CLOSED" }),
    });
    assert(openToClosed.status === 400, "OPEN -> CLOSED rejected with 400 Bad Request");
    assert(openToClosed.body.success === false, "Returns success: false");
    assert(openToClosed.body.message.includes("Invalid status transition"), "Provides descriptive transition error");

    // Invalid: OPEN -> RESOLVED (leap without in-progress)
    const openToResolved = await request("/api/inquiries/inq-101", {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ status: "RESOLVED" }),
    });
    assert(openToResolved.status === 400, "OPEN -> RESOLVED rejected with 400 Bad Request");

    // Valid: OPEN -> IN_PROGRESS
    const openToInProgress = await request("/api/inquiries/inq-101", {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    });
    assert(openToInProgress.status === 200, "OPEN -> IN_PROGRESS succeeds with 200 OK");
    assert(openToInProgress.body.data.status === "IN_PROGRESS", "Inquiry status updated to IN_PROGRESS");

    // Valid: IN_PROGRESS -> RESOLVED
    const inProgressToResolved = await request("/api/inquiries/inq-102", {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ status: "RESOLVED" }),
    });
    assert(inProgressToResolved.status === 200, "IN_PROGRESS -> RESOLVED succeeds with 200 OK");

    // Valid: RESOLVED -> IN_PROGRESS (Reopening permitted if customer replies)
    const resolvedToInProgress = await request("/api/inquiries/inq-103", {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    });
    assert(resolvedToInProgress.status === 200, "RESOLVED -> IN_PROGRESS (reopening) succeeds with 200 OK");

    // Valid: RESOLVED -> CLOSED
    inquiriesDb.find((i) => i.id === "inq-103").status = "RESOLVED";
    const resolvedToClosed = await request("/api/inquiries/inq-103", {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ status: "CLOSED" }),
    });
    assert(resolvedToClosed.status === 200, "RESOLVED -> CLOSED succeeds with 200 OK");

    // Invalid: CLOSED -> IN_PROGRESS or any edit (Closed records are final and immutable)
    const closedEdit = await request("/api/inquiries/inq-104", {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    });
    assert(closedEdit.status === 400, "Modifying a CLOSED inquiry rejected with 400 Bad Request");
    assert(closedEdit.body.message.includes("Closed inquiries are final"), "Clear explanation that closed records cannot be modified");

    // 2. Input Validation
    console.log("\n2. Customer Input Validation:");
    const emptyCreate = await request("/api/inquiries", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    assert(emptyCreate.status === 400, "Empty payload returns 400 Bad Request");
    assert(emptyCreate.body.success === false, "Returns success: false");
    assert(Boolean(emptyCreate.body.details?.customerEmail), "Identifies missing email in details");

    const badEmail = await request("/api/inquiries", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        subject: "Valid Subject",
        description: "Valid Description",
        customerName: "John Doe",
        customerEmail: "not-an-email",
      }),
    });
    assert(badEmail.status === 400, "Malformed email returns 400 Bad Request");

    // 3. Duplicate Submission Policy (5-Minute Window)
    console.log("\n3. Duplicate Submission Policy (5-Minute Window):");
    const validInquiryPayload = {
      subject: "Air Conditioner Maintenance Request",
      description: "Compressor needs routine inspection",
      customerName: "Sarah Connor",
      customerEmail: "s.connor@cyberdyne.org",
    };

    const firstSubmission = await request("/api/inquiries", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(validInquiryPayload),
    });
    assert(firstSubmission.status === 201, "First submission succeeds with 201 Created");

    const duplicateSubmission = await request("/api/inquiries", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(validInquiryPayload),
    });
    assert(duplicateSubmission.status === 409, "Identical submission within 5 min returns 409 Conflict");
    assert(duplicateSubmission.body.success === false, "Duplicate returns success: false");
    assert(duplicateSubmission.body.error === "Conflict", "Error field is 'Conflict'");
    assert(duplicateSubmission.body.message.includes("duplicate inquiry"), "Descriptive duplicate message returned");

    // 4. Missing Records / 404
    console.log("\n4. Missing Record / 404 Handling:");
    const missingRecord = await request("/api/inquiries/non-existent-id-9999", {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    });
    assert(missingRecord.status === 404, "Invalid ID returns standard 404 Not Found");
    assert(missingRecord.body.success === false, "404 returns success: false");
    assert(missingRecord.body.message.includes("does not exist"), "404 includes predictable message");

    console.log("\n=================================================");
    console.log(`📊 WORKFLOW TESTS COMPLETED: ${passed} passed, ${failed} failed`);
    console.log("=================================================\n");

    if (failed > 0) process.exit(1);
  } finally {
    server.close();
  }
}

runWorkflowTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
