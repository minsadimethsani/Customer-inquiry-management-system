# Engineering Decisions & Architecture Summary

This document outlines the architectural assumptions, key design choices, accepted trade-offs, and future improvements implemented in PulseDesk.

---

## 1. Assumptions

1. **Internal Staff-Facing System**: PulseDesk is strictly an internal dispatch, triage, and resolution platform for company staff. Customers do not log into this portal directly; customer identities and contact details are recorded by staff upon intake across various channels (Phone, Email, Chat, Web).
2. **Mandatory Zero-Trust Access Gate**: No route or inquiry data should be accessible without prior authentication. Any user opening the application without an active, verified session is intercepted and prompted to sign in.
3. **Admin Supremacy & Least-Privilege Staff Access**: Administrators inherently possess universal rights (all system permissions). Regular staff accounts operate under the principle of least privilege, with explicit granular permissions granted by an Administrator.

---

## 2. Meaningful Design Choices

### Choice 1: Native Array Permissions Model (`permissions text[]`)
* **Decision**: Instead of creating a multi-table relational schema (`roles`, `permissions`, `user_roles`, `role_permissions`), permissions are stored directly on the `users` table as a native PostgreSQL string array (`permissions text[]`).
* **Rationale**:
  * Eliminates multiple multi-table SQL `JOIN`s on every authenticated request.
  * Allows the permissions array to be serialized directly into the signed JWT token payload. Both the Express backend middleware (`authorizePermissions`) and the Next.js frontend (`hasPermission`) can verify user capabilities instantaneously with $O(1)$ lookups without querying the database repeatedly.

### Choice 2: Client-Side Auth Provider Gate over Server Redirect Flashes
* **Decision**: Implemented an application-level [`AuthContext`](file:///F:/Customer-inquiry-management-system/frontend/app/context/AuthContext.tsx) that encapsulates authentication state, token storage, and session validation against `/api/auth/me`.
* **Rationale**:
  * Intercepts unauthenticated users immediately and renders the [`LoginPage`](file:///F:/Customer-inquiry-management-system/frontend/app/components/LoginPage.tsx) in-place without causing jarring multiple HTTP 302 redirect loops between `/` and `/login`.
  * Enables responsive, optimistic UI updates across all components when logging in, switching views, or signing out.

### Choice 3: Left Sidebar Navigation over Cluttered Top Header
* **Decision**: Completely replaced the horizontal top header with a vertical, collapsible [`Sidebar`](file:///F:/Customer-inquiry-management-system/frontend/app/components/Sidebar.tsx).
* **Rationale**:
  * As the system grew to accommodate high-frequency actions (Log New Inquiry, Manage Staff, Inquiries Hub, Table Directory, live queue count badges), horizontal top bars became overcrowded and poor on smaller screens.
  * The vertical sidebar provides clear visual separation between primary actions, core navigation, workflow filter shortcuts, and the bottom session/user profile panel.

### Choice 4: Custom Contextual Messaging over Generic Default Fallbacks
* **Decision**: Eliminated all default error and success strings (e.g., `"Update successful"`, `"Validation error"`, `"Failed to update"`) across both backend API responses and frontend toast/modal alerts. Every failure and success condition returns a dynamic, context-aware message specifying the exact record, field, actor, or lifecycle restriction involved.
* **Rationale**:
  * In a multi-user dispatch workflow, generic errors leave agents confused about why an action was rejected (e.g. distinguishing between a closed record lock, an invalid status transition, or a missing permission capability).
  * Context-rich messages identify the exact constraint (e.g., `Ticket #INQ-1004 is archived (CLOSED) and cannot undergo further status transitions`) which accelerates agent onboarding and eliminates ambiguity.

---

## 3. Trade-off Accepted

### Accepted Trade-off: LocalStorage JWT Storage vs. HttpOnly Cookie Refresh Tokens
* **The Trade-off**: Storing the JWT token in browser `localStorage` rather than server-issued `HttpOnly` `SameSite=Strict` cookies.
* **Why it was accepted**:
  * PulseDesk runs in a decoupled local architecture (Frontend on `localhost:3000`, Express API on `localhost:5000`). Using `localStorage` avoids complex cross-origin cookie policies, CORS preflight credential handshakes, and SSL cookie constraints during local evaluation.
* **Risk & Mitigation**:
  * LocalStorage is vulnerable to XSS token theft if untrusted script execution occurs.
  * Mitigated in this scope by using a 24-hour token expiration (`JWT_EXPIRES_IN=24h`), sanitizing message and inquiry inputs, and avoiding `dangerouslySetInnerHTML`.

---

## 4. What Would You Improve Next

1. **HttpOnly Cookie Authentication with Refresh Token Rotation**:
   * Migrate authentication to `HttpOnly`, secure cookies with a short-lived access token (15 minutes) and a rolling refresh token stored in Redis or database sessions.
2. **Real-Time Queue Updates via WebSockets (Socket.IO / SSE)**:
   * Push live notifications to active staff members when an inquiry is claimed, escalated to Urgent, or resolved by a colleague to prevent duplicate triage efforts.
3. **Department & Category Data Scoping**:
   * Extend the RBAC engine so staff accounts can be restricted to only view and triage inquiries within their specific assigned department (e.g., Billing staff only view Billing inquiries).
4. **Staff Invite Tokens & Password Reset**:
   * Replace admin-generated initial passwords with secure email invite tokens, allowing new staff members to set their own initial credentials upon first login.
