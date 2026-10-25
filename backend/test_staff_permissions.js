const http = require("http");
const app = require("./src/app");
const prisma = require("./src/lib/prisma");

let server;
let baseUrl;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let parsed = {};
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        });
      }
    );

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log("=========================================");
  console.log("🧪 TESTING STAFF CREATION & SPECIFIC ACCESS");
  console.log("=========================================\n");

  let passed = 0;
  let failed = 0;

  function assert(desc, condition) {
    if (condition) {
      console.log(`  ✓ ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
      failed++;
    }
  }

  // Start test server on random port
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  try {
    // 1. Log in as existing Admin
    console.log("1. Admin Login & Token Extraction:");
    const adminLoginRes = await request("POST", "/api/auth/login", {
      email: "admin@example.com",
      password: "Password123!",
    });
    console.log("Admin Login response:", adminLoginRes.status, adminLoginRes.data);
    assert("Admin login returns 200 OK", adminLoginRes.status === 200);
    assert("Admin response contains token", Boolean(adminLoginRes.data.token));
    assert("Admin role is ADMIN", adminLoginRes.data.user.role === "ADMIN");
    assert("Admin has staff:manage permission", adminLoginRes.data.user.permissions?.includes("staff:manage"));
    const adminToken = adminLoginRes.data.token;

    // 2. Log in as existing Agent (Sarah)
    console.log("\n2. Agent Login (Non-Admin):");
    const agentLoginRes = await request("POST", "/api/auth/login", {
      email: "agent.sarah@example.com",
      password: "Password123!",
    });
    assert("Agent login returns 200 OK", agentLoginRes.status === 200);
    const agentToken = agentLoginRes.data.token;

    // 3. Agent attempting to create staff account
    console.log("\n3. Agent (Non-Admin) Authorization Guard:");
    const agentCreateRes = await request(
      "POST",
      "/api/staff",
      {
        name: "Hacker Staff",
        email: "hacker@example.com",
        password: "Password123!",
      },
      agentToken
    );
    assert("Agent attempting to create staff receives 403 Forbidden", agentCreateRes.status === 403);

    // 4. Admin creating staff account with specific access permissions
    console.log("\n4. Admin Creating Staff Account with Specific Access:");
    const testStaffEmail = `triage.agent.${Date.now()}@example.com`;
    // Clean up if existed
    await prisma.user.deleteMany({ where: { email: testStaffEmail } });

    const specificPermissions = [
      "inquiries:create",
      "inquiries:assign",
      // Notice: NO "inquiries:update_priority" or "inquiries:update_status"
    ];

    const createStaffRes = await request(
      "POST",
      "/api/staff",
      {
        name: "Test Triage Agent",
        email: testStaffEmail,
        password: "Password123!",
        role: "AGENT",
        department: "Triage & Intake Desk",
        permissions: specificPermissions,
      },
      adminToken
    );

    assert("Admin creating staff account returns 201 Created", createStaffRes.status === 201);
    assert("Returned data has assigned email", createStaffRes.data.data?.email === testStaffEmail);
    assert("Returned data has exact permissions assigned", 
      JSON.stringify(createStaffRes.data.data?.permissions.sort()) === JSON.stringify(specificPermissions.sort())
    );

    // 5. Test duplicate email rejection
    console.log("\n5. Duplicate Email Validation:");
    const dupRes = await request(
      "POST",
      "/api/staff",
      {
        name: "Duplicate User",
        email: testStaffEmail,
        password: "Password123!",
        role: "AGENT",
      },
      adminToken
    );
    assert("Duplicate email returns 409 Conflict", dupRes.status === 409);

    // 6. Test logging in with newly created staff credentials
    console.log("\n6. Newly Created Staff Logging In with Credentials:");
    const newStaffLogin = await request("POST", "/api/auth/login", {
      email: testStaffEmail,
      password: "Password123!",
    });

    assert("Newly created staff logs in with 200 OK", newStaffLogin.status === 200);
    assert("Returned user has specific permissions", 
      newStaffLogin.data.user.permissions?.includes("inquiries:create") &&
      !newStaffLogin.data.user.permissions?.includes("inquiries:update_priority")
    );
    const newStaffToken = newStaffLogin.data.token;

    // 7. Verify /api/auth/me returns updated permissions
    console.log("\n7. Verify /api/auth/me for New Staff:");
    const meRes = await request("GET", "/api/auth/me", null, newStaffToken);
    assert("GET /api/auth/me returns 200 OK", meRes.status === 200);
    assert("Profile matches assigned permissions", 
      meRes.data.user?.permissions?.includes("inquiries:assign") &&
      !meRes.data.user?.permissions?.includes("inquiries:update_priority")
    );

    // 8. Test specific access enforcement: Triage agent creating inquiry (ALLOWED)
    console.log("\n8. Specific Access Enforcement (Allowed Action):");
    const testInquiryRes = await request(
      "POST",
      "/api/inquiries",
      {
        subject: `Test Inquiry by Triage ${Date.now()}`,
        description: "Customer needs urgent assistance with their heating unit.",
        customerName: "Jane Doe",
        customerEmail: "jane.doe@example.com",
        customerPhone: "555-0199",
      },
      newStaffToken
    );
    assert("Staff with 'inquiries:create' can create inquiry (201 Created)", testInquiryRes.status === 201);
    const createdInqId = testInquiryRes.data.data?.id;

    // 9. Test specific access enforcement: Triage agent modifying priority (FORBIDDEN)
    console.log("\n9. Specific Access Enforcement (Forbidden Action):");
    const priorityUpdateRes = await request(
      "PATCH",
      `/api/inquiries/${createdInqId}`,
      {
        priority: "URGENT",
      },
      newStaffToken
    );
    assert("Staff lacking 'inquiries:update_priority' receives 403 Forbidden", priorityUpdateRes.status === 403);
    assert("Error message mentions permission", priorityUpdateRes.data?.message?.includes("permission"));

    // 10. Admin can update staff permissions
    console.log("\n10. Admin Updating Staff Permissions:");
    const staffId = createStaffRes.data.data?.id;
    const updatePermsRes = await request(
      "PATCH",
      `/api/staff/${staffId}`,
      {
        permissions: [...specificPermissions, "inquiries:update_priority"],
      },
      adminToken
    );
    assert("Admin updating staff permissions returns 200 OK", updatePermsRes.status === 200);
    assert("Updated staff has new permission in response", updatePermsRes.data.data?.permissions?.includes("inquiries:update_priority"));

    // Clean up test inquiry and user
    if (createdInqId) {
      await prisma.inquiry.deleteMany({ where: { id: createdInqId } });
    }
    await prisma.user.deleteMany({ where: { email: testStaffEmail } });

  } catch (err) {
    console.error("Test error:", err);
    failed++;
  } finally {
    if (server) server.close();
    await prisma.$disconnect();
  }

  console.log("\n=========================================");
  console.log(`📊 TESTS COMPLETED: ${passed} passed, ${failed} failed`);
  console.log("=========================================\n");

  if (failed > 0) process.exit(1);
}

runTests();
