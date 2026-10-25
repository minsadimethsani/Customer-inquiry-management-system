import {
  PrismaClient,
  Role,
  Priority,
  InquiryStatus,
  InquiryChannel,
} from "@prisma/client";

const prisma = new PrismaClient();

// Standard test password hash (representing "Password123!")
const TEST_PASSWORD_HASH =
  "$2b$10$IPQYdqcyoLM0HEkpLMF0iuYDRtnr7cqFJuJU9yL5n3Z7KXKdMTWxS";

// Super Admin password hash (representing "Methsani123#")
const SUPER_ADMIN_PASSWORD_HASH =
  "$2b$10$vztcx8aiM93un310LN/d4O9USkKhezmbOnOqZ0SbD2bsKGnZX/Vz.";

const ALL_ADMIN_PERMISSIONS = [
  "inquiries:create",
  "inquiries:update_status",
  "inquiries:assign",
  "inquiries:update_priority",
  "inquiries:add_notes",
  "inquiries:close",
  "inquiries:view_all",
  "inquiries:delete",
  "staff:manage",
];

// System users are strictly staff members who record and handle inquiries
export const TEST_STAFF_USERS = [
  {
    email: "mmethsani@gmail.com",
    name: "Super Administrator",
    role: Role.ADMIN,
    passwordHash: SUPER_ADMIN_PASSWORD_HASH,
    department: "Executive Management",
    permissions: ALL_ADMIN_PERMISSIONS,
  },
  {
    email: "admin@example.com",
    name: "System Administrator",
    role: Role.ADMIN,
    passwordHash: TEST_PASSWORD_HASH,
    department: "Executive Management",
    permissions: ALL_ADMIN_PERMISSIONS,
  },
  {
    email: "elena.r@services.com",
    name: "Elena Rostova",
    role: Role.ADMIN,
    passwordHash: TEST_PASSWORD_HASH,
    department: "Operations Lead & Dispatch",
  },
  {
    email: "agent.sarah@example.com",
    name: "Sarah Jenkins",
    role: Role.AGENT,
    passwordHash: TEST_PASSWORD_HASH,
    department: "Customer Success & Triage",
  },
  {
    email: "michael.c@services.com",
    name: "Michael Chen",
    role: Role.AGENT,
    passwordHash: TEST_PASSWORD_HASH,
    department: "Technical & Field Services",
  },
  {
    email: "marcus.b@services.com",
    name: "Marcus Brody",
    role: Role.AGENT,
    passwordHash: TEST_PASSWORD_HASH,
    department: "Billing & Invoicing Team",
  },
];

export const TEST_CATEGORIES = [
  {
    name: "Technical Support",
    description: "Assistance with system bugs, mechanical errors, and technical setup",
    color: "#EF4444",
  },
  {
    name: "Billing & Invoicing",
    description: "Questions regarding invoices, credits, payments, and subscriptions",
    color: "#10B981",
  },
  {
    name: "Service Scheduling",
    description: "Maintenance appointments, technician dispatch, and rescheduling",
    color: "#3B82F6",
  },
  {
    name: "Urgent Escalation",
    description: "Critical emergency requests needing immediate field response",
    color: "#F59E0B",
  },
  {
    name: "General Inquiries",
    description: "General product questions, service catalog, and contracts",
    color: "#8B5CF6",
  },
];

async function main() {
  console.log("=========================================");
  console.log("🌱 SEEDING DATABASE: PULSEDESK (STAFF ONLY USERS)");
  console.log("=========================================\n");

  // 1. Seed Categories
  console.log("📁 1. Seeding Inquiry Categories...");
  const categoryMap = new Map<string, string>();
  for (const cat of TEST_CATEGORIES) {
    const createdCat = await prisma.category.upsert({
      where: { name: cat.name },
      update: { description: cat.description, color: cat.color },
      create: cat,
    });
    categoryMap.set(cat.name, createdCat.id);
    console.log(`   ✓ Category: ${cat.name} (${cat.color})`);
  }

  // 2. Seed Staff User Accounts
  console.log("\n👥 2. Seeding Staff User Accounts...");
  const staffMap = new Map<string, string>();
  for (const staff of TEST_STAFF_USERS) {
    const createdStaff = await prisma.user.upsert({
      where: { email: staff.email },
      update: {
        name: staff.name,
        role: staff.role,
        department: staff.department,
        passwordHash: staff.passwordHash,
        permissions: staff.permissions || (staff.role === Role.ADMIN ? ALL_ADMIN_PERMISSIONS : []),
      },
      create: {
        ...staff,
        permissions: staff.permissions || (staff.role === Role.ADMIN ? ALL_ADMIN_PERMISSIONS : []),
      },
    });
    staffMap.set(staff.email, createdStaff.id);
    console.log(
      `   ✓ [${staff.role.padEnd(6)}] ${staff.name.padEnd(20)} (${staff.email}) - ${staff.department}`
    );
  }

  // 3. Seed Sample Inquiries recorded by staff on behalf of customers
  console.log("\n🎫 3. Seeding Sample Customer Inquiries recorded by staff...");

  const adminElenaId = staffMap.get("elena.r@services.com")!;
  const agentSarahId = staffMap.get("agent.sarah@example.com")!;
  const billingCatId = categoryMap.get("Billing & Invoicing")!;

  const sampleInquiry = await prisma.inquiry.upsert({
    where: { ticketNumber: "INQ-1001" },
    update: {},
    create: {
      ticketNumber: "INQ-1001",
      subject: "Unable to update billing payment method in client portal",
      description:
        "Customer called saying credit card update returns 500 error on checkout.",
      status: InquiryStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      channel: InquiryChannel.PHONE,

      // Customer contact details stored directly on inquiry
      customerName: "Dr. Amanda Vance",
      customerEmail: "a.vance@downtownhealth.org",
      customerPhone: "+1 (555) 349-8821",
      customerCompany: "Downtown Health Clinic",

      // Recorded by Elena, assigned to Sarah
      createdById: adminElenaId,
      assignedToId: agentSarahId,
      categoryId: billingCatId,

      messages: {
        create: [
          {
            senderName: "Dr. Amanda Vance (Customer)",
            body: "Hi team, we are trying to renew our annual clinic plan but the billing portal page fails to load.",
            isInternalNote: false,
          },
          {
            senderId: agentSarahId,
            senderName: "Sarah Jenkins",
            body: "Investigating customer gateway logs. Stripe webhook seems active. Contacting merchant support.",
            isInternalNote: true,
          },
        ],
      },
      activityLogs: {
        create: [
          {
            actorId: adminElenaId,
            action: "INQUIRY_CREATED",
            oldValue: null,
            newValue: "OPEN",
          },
          {
            actorId: adminElenaId,
            action: "ASSIGNED",
            oldValue: "Unassigned",
            newValue: "Sarah Jenkins",
          },
          {
            actorId: agentSarahId,
            action: "STATUS_CHANGED",
            oldValue: "OPEN",
            newValue: "IN_PROGRESS",
          },
        ],
      },
    },
  });

  console.log(`   ✓ Ticket created: ${sampleInquiry.ticketNumber} - ${sampleInquiry.subject}`);
  console.log(`     Customer: ${sampleInquiry.customerName} (${sampleInquiry.customerEmail})`);
  console.log(`     Recorded By Staff: Elena Rostova`);
  console.log(`     Assigned Staff: Sarah Jenkins`);

  console.log("\n=========================================");
  console.log("✅ SEEDING COMPLETED SUCCESSFULLY");
  console.log("=========================================");
  console.log("\n🔑 Test Staff Credentials (All passwords: 'Password123!'):");
  console.log("  • Admin (Executive): admin@example.com");
  console.log("  • Admin (Dispatch):  elena.r@services.com");
  console.log("  • Agent (Support):   agent.sarah@example.com");
  console.log("  • Agent (Field Tech):michael.c@services.com");
  console.log("  • Agent (Billing):   marcus.b@services.com");
  console.log("=========================================\n");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
