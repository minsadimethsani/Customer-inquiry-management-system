# PulseDesk — Customer Inquiry Management System

PulseDesk is an end-to-end customer inquiry and service dispatch management platform designed to eliminate lost requests from spreadsheets and chat apps. It provides real-time ticket intake, ownership handover, lifecycle status tracking, conversation threads, and role-based access control.

---

## Tech Stack

* **Frontend**: Next.js 16 (App Router, React 19, Tailwind CSS, Lucide Icons)
* **Backend**: Node.js, Express 5, JWT authentication, bcryptjs
* **Database & ORM**: PostgreSQL with Prisma ORM
* **Containerization**: Docker Compose (PostgreSQL 16)

---

## Prerequisites

* **Node.js**: v18.0.0 or later (v20+ recommended)
* **npm**: v9+
* **Docker & Docker Compose** (or a local PostgreSQL instance running on port 5432)

---

## Quick Setup & Running Locally

### 1. Start PostgreSQL Database

Using Docker Compose from the root directory:

```bash
docker compose up -d
```

*(Ensure PostgreSQL is accessible on port `5432` with user `postgres` and password `postgres` or as configured in `backend/.env`).*

---

### 2. Backend Setup & Startup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables (a `.env` file is provided, or copy from `.env.example`):
   ```env
   PORT=5000
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/customer_inquiry_db?schema=public"
   JWT_SECRET="super_secret_jwt_key_pulsedesk_2026_dev"
   JWT_EXPIRES_IN="24h"
   ```

4. Generate Prisma Client and apply database migrations:
   ```bash
   npm run prisma:generate
   ```

5. Seed initial accounts and demo inquiries:
   ```bash
   npm run seed
   ```

6. Start the backend development server:
   ```bash
   npm run dev
   ```
   *The API will start at **http://localhost:5000**.*

---

### 3. Frontend Setup & Startup

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
   *The web application will open at **http://localhost:3000**.*

---

## Default Test Accounts

Every visitor must sign in with their credentials upon opening the website. Use any of the following pre-configured staff accounts:

| Role | Name | Email (Username) | Password | Access Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | Super Administrator | `mmethsani@gmail.com` | `Methsani123#` | Full universal administrative access, staff account creation & permission management |
| **Admin** | System Administrator | `admin@example.com` | `Password123!` | Full universal administrative access |
| **Admin** | Elena Rostova | `elena.r@services.com` | `Password123!` | Full universal administrative access & dispatch |
| **Staff (Agent)** | Sarah Jenkins | `agent.sarah@example.com` | `Password123!` | Customer Success & Triage (intake, status, assign, notes) |
| **Staff (Agent)** | Michael Chen | `michael.c@services.com` | `Password123!` | Technical Field Services |
| **Staff (Agent)** | Marcus Brody | `marcus.b@services.com` | `Password123!` | Billing & Invoicing Team |

---

## Key Features

1. **Mandatory Login Gate**:
   * Every user must first sign in with their registered credentials to access the platform.
   * Sessions are authenticated using JWT and verified against `/api/auth/me`.

2. **Left Sidebar Navigation**:
   * Clean vertical left navigation bar replaces top headers across all pages.
   * Includes direct links to **Inquiries Hub**, **Table Directory**, **Queue Filters** (Needs Owner, Assigned to Me, In Progress, Resolved), and the **Sign Out** action.

3. **Admin Staff Account Creation & Specific Access**:
   * Administrators can click **"Manage Staff"** in the sidebar to open the Staff Control Panel.
   * Admins can create new staff members and configure granular, account-specific access permissions:
     * `inquiries:create`: Intake and record new inquiries.
     * `inquiries:update_status`: Progress inquiry lifecycle (`OPEN`, `IN_PROGRESS`).
     * `inquiries:assign`: Assign and handover tickets to team members.
     * `inquiries:update_priority`: Escalate ticket priority.
     * `inquiries:add_notes`: Post internal notes and customer replies.
     * `inquiries:close`: Mark tickets as resolved or closed.
     * `inquiries:view_all`: View all organization-wide tickets.
     * `inquiries:delete`: Archive or soft-delete inquiry records.

---

## Running Automated Tests

Run the full backend test suite covering authentication, RBAC, state transitions, validation, and staff permission guards:

```bash
cd backend
npm test
```

*(Runs 72 assertions across `test_auth.js`, `test_rbac.js`, `test_workflow.js`, and `test_staff_permissions.js`).*
