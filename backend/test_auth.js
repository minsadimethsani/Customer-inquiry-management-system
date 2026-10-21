const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { authenticate, authorizeRoles } = require("./src/middleware/auth");
const authRoutes = require("./src/routes/authRoutes");

// Set environment for test
process.env.JWT_SECRET = "test_jwt_secret_123";
process.env.NODE_ENV = "test";

async function runTests() {
  console.log("=========================================");
  console.log("🧪 TESTING BACKEND AUTHENTICATION SYSTEM");
  console.log("=========================================\n");

  // Create isolated test app with all auth middleware and routes
  const testApp = express();
  testApp.use(express.json());

  // Mount auth routes
  testApp.use("/api/auth", authRoutes);

  // Protected test route using authenticate middleware
  testApp.get("/api/test-protected", authenticate, (req, res) => {
    res.json({ success: true, user: req.user });
  });

  // Admin-only route using authorizeRoles middleware
  testApp.get("/api/test-admin-only", authenticate, authorizeRoles("ADMIN"), (req, res) => {
    res.json({ success: true, user: req.user });
  });

  // 404 handler
  testApp.use((req, res) => {
    res.status(404).json({ error: "Not Found" });
  });

  const server = http.createServer(testApp);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  let passed = 0;
  let failed = 0;

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

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Validation: Missing fields on login
    console.log("1. Login Input Validation:");
    const emptyLogin = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({}),
    });
    assert(emptyLogin.status === 400, "POST /api/auth/login with empty body returns 400");
    assert(emptyLogin.body.error === "Validation Error", "Returns 'Validation Error'");

    const missingPass = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@example.com" }),
    });
    assert(missingPass.status === 400, "POST /api/auth/login with missing password returns 400");

    const missingEmail = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: "Password123!" }),
    });
    assert(missingEmail.status === 400, "POST /api/auth/login with missing email returns 400");

    // 2. Auth Middleware: Missing Token
    console.log("\n2. Protected Route Without Token:");
    const noToken = await request("/api/test-protected");
    assert(noToken.status === 401, "Protected route without Authorization header returns 401 Unauthorized");
    assert(noToken.body.error === "Unauthorized", "Returns error: 'Unauthorized'");
    assert(noToken.body.message.includes("No authorization header"), "Returns descriptive message");

    // 3. Auth Middleware: Malformed Authorization Header
    console.log("\n3. Protected Route With Malformed Token Header:");
    const malformed = await request("/api/test-protected", {
      headers: { Authorization: "Basic dXNlcjpwYXNz" },
    });
    assert(malformed.status === 401, "Protected route without 'Bearer' prefix returns 401 Unauthorized");

    const badToken = await request("/api/test-protected", {
      headers: { Authorization: "Bearer this_is_a_corrupted_token" },
    });
    assert(badToken.status === 401, "Protected route with tampered token returns 401 Unauthorized");

    // 4. Auth Middleware: Valid Token Verification & req.user attachment
    console.log("\n4. Token Signing & req.user Attachment:");
    const staffPayload = {
      id: "usr-staff-101",
      name: "Sarah Jenkins",
      email: "agent.sarah@example.com",
      role: "AGENT",
    };
    const agentToken = jwt.sign(staffPayload, process.env.JWT_SECRET, { expiresIn: "1h" });

    const protectedRes = await request("/api/test-protected", {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    assert(protectedRes.status === 200, "Protected route with valid Bearer token returns 200 OK");
    assert(protectedRes.body.user.id === "usr-staff-101", "req.user.id successfully extracted from token");
    assert(protectedRes.body.user.email === "agent.sarah@example.com", "req.user.email matches signed token");
    assert(protectedRes.body.user.role === "AGENT", "req.user.role correctly assigned to req.user");

    // 5. Role-based Authorization Guard
    console.log("\n5. Role-based Authorization Guard:");
    const agentAccessAdmin = await request("/api/test-admin-only", {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    assert(agentAccessAdmin.status === 403, "AGENT role attempting ADMIN route receives 403 Forbidden");

    const adminPayload = {
      id: "usr-admin-999",
      name: "Elena Rostova",
      email: "elena.r@services.com",
      role: "ADMIN",
    };
    const adminToken = jwt.sign(adminPayload, process.env.JWT_SECRET, { expiresIn: "1h" });

    const adminAccessAdmin = await request("/api/test-admin-only", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminAccessAdmin.status === 200, "ADMIN role accessing ADMIN route receives 200 OK");

    // 6. Bcrypt Password Verification
    console.log("\n6. Bcrypt Password Comparison Check:");
    const rawPassword = "Password123!";
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(rawPassword, salt);

    const isMatch = await bcrypt.compare(rawPassword, hash);
    const isWrong = await bcrypt.compare("WrongPassword!", hash);

    assert(isMatch === true, "bcrypt.compare validates correct password");
    assert(isWrong === false, "bcrypt.compare rejects incorrect password");

    console.log("\n=========================================");
    console.log(`📊 TESTS COMPLETED: ${passed} passed, ${failed} failed`);
    console.log("=========================================\n");

    if (failed > 0) process.exit(1);
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
