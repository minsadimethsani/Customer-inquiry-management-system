const prisma = require("../lib/prisma");

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Generate a sequential ticket number like INQ-1042.
 * Finds the highest existing numeric suffix and increments it.
 */
async function generateTicketNumber() {
  const latest = await prisma.inquiry.findFirst({
    orderBy: { createdAt: "desc" },
    select: { ticketNumber: true },
  });

  if (!latest) return "INQ-1001";

  const match = latest.ticketNumber.match(/^INQ-(\d+)$/);
  if (!match) return "INQ-1001";

  const next = parseInt(match[1], 10) + 1;
  return `INQ-${next}`;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Inquiry Status Workflow & State Machine
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * State Transition Rules & Architectural Reasoning:
 * 1. 'OPEN' -> 'IN_PROGRESS':
 *    Incoming inquiry is claimed/assigned and actively being investigated by staff.
 *    Invalid: Cannot jump from 'OPEN' straight to 'CLOSED' or 'RESOLVED'.
 *
 * 2. 'IN_PROGRESS' -> 'PENDING_CUSTOMER' | 'RESOLVED':
 *    Staff asks customer for clarification ('PENDING_CUSTOMER') or implements fix ('RESOLVED').
 *    Invalid: Cannot jump straight to 'CLOSED' without resolution. Cannot regress to 'OPEN'.
 *
 * 3. 'PENDING_CUSTOMER' -> 'IN_PROGRESS' | 'RESOLVED':
 *    Customer replies with requested data ('IN_PROGRESS') or confirms resolution ('RESOLVED').
 *    Invalid: Cannot jump straight to 'CLOSED' without resolution. Cannot regress to 'OPEN'.
 *
 * 4. 'RESOLVED' -> 'IN_PROGRESS' | 'CLOSED':
 *    - 'RESOLVED' -> 'CLOSED': Final customer acceptance or SLA completion.
 *    - 'RESOLVED' -> 'IN_PROGRESS': Reopening permitted if customer responds that the issue recurred.
 *    Invalid: Cannot regress to 'OPEN' or 'PENDING_CUSTOMER'.
 *
 * 5. 'CLOSED' -> (None - Terminal):
 *    CLOSED inquiries are final, immutable records preserved for compliance and audit trails.
 *    Cannot be reopened, transitioned, or modified.
 */
const ALLOWED_STATUS_TRANSITIONS = {
  OPEN: ["IN_PROGRESS"],
  IN_PROGRESS: ["PENDING_CUSTOMER", "RESOLVED"],
  PENDING_CUSTOMER: ["IN_PROGRESS", "RESOLVED"],
  RESOLVED: ["IN_PROGRESS", "CLOSED"],
  CLOSED: [],
};

/**
 * Standard Inquiry select object — used across list and detail queries
 * to keep response shapes consistent.
 */
const INQUIRY_SELECT = {
  id: true,
  ticketNumber: true,
  subject: true,
  description: true,
  status: true,
  priority: true,
  channel: true,
  customerName: true,
  customerEmail: true,
  customerPhone: true,
  customerCompany: true,
  resolvedAt: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: { id: true, name: true, email: true, department: true },
  },
  assignedTo: {
    select: { id: true, name: true, email: true, department: true },
  },
  category: {
    select: { id: true, name: true, color: true },
  },
};

/**
 * Write an activity log entry inside a transaction context.
 */
async function logActivity(tx, { inquiryId, actorId, action, oldValue, newValue, metadata }) {
  return tx.inquiryActivityLog.create({
    data: {
      inquiryId,
      actorId: actorId || null,
      action,
      oldValue: oldValue != null ? String(oldValue) : null,
      newValue: newValue != null ? String(newValue) : null,
      metadata: metadata || undefined,
    },
  });
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * GET /api/inquiries
 * List all inquiries with optional filtering and pagination.
 *
 * Query params:
 *   status, priority, channel, assignedToId, categoryId,
 *   search (full-text on subject / customerName / customerEmail),
 *   page (default 1), limit (default 20, max 100)
 */
exports.listInquiries = async (req, res, next) => {
  try {
    const {
      status,
      priority,
      channel,
      assignedToId,
      categoryId,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Build dynamic where clause
    const where = {};
    if (status && status !== "ALL") where.status = status.toUpperCase();
    if (priority && priority !== "ALL") where.priority = priority.toUpperCase();
    if (channel && channel !== "ALL") where.channel = channel.toUpperCase();
    if (categoryId && categoryId !== "ALL") where.categoryId = categoryId;

    const andConditions = [];

    // ── RBAC Access Rule Enforcement ──────────────────────────────────────────
    // - ADMIN can view, manage, and update all customer inquiries across the system.
    // - Staff with 'inquiries:view_all' permission can view all inquiries.
    // - Staff without 'inquiries:view_all' can view general inquiries (unassigned) or specifically assigned inquiries.
    const isAdmin = req.user?.role === "ADMIN";
    const canViewAll = isAdmin || (Array.isArray(req.user?.permissions) && req.user.permissions.includes("inquiries:view_all"));
    if (!canViewAll) {
      andConditions.push({
        OR: [
          { assignedToId: req.user?.id },
          { assignedToId: null },
          { createdById: req.user?.id },
        ],
      });

      if (assignedToId && assignedToId !== "ALL") {
        if (assignedToId === "unassigned" || assignedToId === "null") {
          andConditions.push({ assignedToId: null });
        } else {
          andConditions.push({ assignedToId: req.user?.id });
        }
      }
    } else {
      if (assignedToId && assignedToId !== "ALL") {
        where.assignedToId = assignedToId;
      }
    }

    if (search && search.trim()) {
      const term = search.trim();
      andConditions.push({
        OR: [
          { subject: { contains: term, mode: "insensitive" } },
          { customerName: { contains: term, mode: "insensitive" } },
          { customerEmail: { contains: term, mode: "insensitive" } },
          { ticketNumber: { contains: term, mode: "insensitive" } },
          { customerCompany: { contains: term, mode: "insensitive" } },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [total, inquiries] = await Promise.all([
      prisma.inquiry.count({ where }),
      prisma.inquiry.findMany({
        where,
        select: INQUIRY_SELECT,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: limitNum,
      }),
    ]);

    return res.status(200).json({
      data: inquiries,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/inquiries/:id
 * Get a single inquiry with full details including messages and activity log.
 */
exports.getInquiry = async (req, res, next) => {
  try {
    const { id } = req.params;

    const inquiry = await prisma.inquiry.findUnique({
      where: { id },
      select: {
        ...INQUIRY_SELECT,
        messages: {
          select: {
            id: true,
            senderName: true,
            body: true,
            isInternalNote: true,
            createdAt: true,
            updatedAt: true,
            sender: { select: { id: true, name: true, email: true } },
            attachments: {
              select: {
                id: true,
                fileName: true,
                fileUrl: true,
                fileSize: true,
                mimeType: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        activityLogs: {
          select: {
            id: true,
            action: true,
            oldValue: true,
            newValue: true,
            metadata: true,
            createdAt: true,
            actor: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        feedback: true,
      },
    });

    if (!inquiry) {
      return res.status(404).json({
        error: "Not Found",
        message: `Inquiry with id '${id}' does not exist.`,
      });
    }

    // ── RBAC Access Rule Enforcement ──────────────────────────────────────────
    // - ADMIN can view all customer inquiries across the system.
    // - Staff with 'inquiries:view_all' can view any inquiry.
    // - Staff without 'inquiries:view_all' can view general inquiries (unassigned) or specifically assigned inquiries.
    const canViewAllInq = req.user?.role === "ADMIN" || (Array.isArray(req.user?.permissions) && req.user.permissions.includes("inquiries:view_all"));
    if (!canViewAllInq) {
      const isAssigned = Boolean(inquiry.assignedTo && inquiry.assignedTo.id === req.user?.id);
      const isUnassigned = !inquiry.assignedTo;
      const isCreator = Boolean(inquiry.createdBy && inquiry.createdBy.id === req.user?.id);

      if (!isAssigned && !isUnassigned && !isCreator) {
        return res.status(403).json({
          error: "Forbidden",
          message: "You are not authorized to view this inquiry. It is assigned to another staff member.",
        });
      }
    }

    return res.status(200).json({ data: inquiry });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/inquiries
 * Create a new inquiry. The authenticated staff member is set as createdBy.
 *
 * Body: subject, description, customerName, customerEmail, customerPhone?,
 *       customerCompany?, priority?, channel?, categoryId?, assignedToId?,
 *       initialMessage? (string for the first customer-facing message)
 */
exports.createInquiry = async (req, res, next) => {
  try {
    const {
      subject,
      description,
      customerName,
      customerEmail,
      customerPhone,
      customerCompany,
      priority = "MEDIUM",
      channel = "PHONE",
      categoryId,
      assignedToId,
      initialMessage,
    } = req.body;

    // ── Validation ──────────────────────────────────────────────────────────
    const errors = {};
    if (!subject || !subject.trim()) errors.subject = "Subject is required to summarize the customer inquiry.";
    if (!description || !description.trim()) errors.description = "Detailed issue description is required.";
    if (!customerName || !customerName.trim()) errors.customerName = "Customer contact name is required.";
    if (!customerEmail || !customerEmail.trim()) {
      errors.customerEmail = "Customer contact email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
      errors.customerEmail = `'${customerEmail.trim()}' is not a valid email address.`;
    }

    const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
    const VALID_CHANNELS = ["WEB_PORTAL", "EMAIL", "CHAT", "PHONE"];
    if (!VALID_PRIORITIES.includes(priority)) {
      errors.priority = `Invalid priority '${priority}'. Allowed priorities are: ${VALID_PRIORITIES.join(", ")}.`;
    }
    if (!VALID_CHANNELS.includes(channel)) {
      errors.channel = `Invalid intake channel '${channel}'. Allowed channels are: ${VALID_CHANNELS.join(", ")}.`;
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        error: "Validation Error",
        message: Object.values(errors)[0] || "Invalid inquiry input fields.",
        details: errors,
      });
    }

    // ── Foreign-key validation ───────────────────────────────────────────────
    if (categoryId) {
      const category = await prisma.category.findUnique({ where: { id: categoryId } });
      if (!category) {
        return res.status(400).json({
          success: false,
          error: "Validation Error",
          message: `Category with ID '${categoryId}' does not exist or has been removed.`,
        });
      }
    }
    if (assignedToId) {
      const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
      if (!assignee || !assignee.isActive) {
        return res.status(400).json({
          success: false,
          error: "Validation Error",
          message: `Assigned staff member with ID '${assignedToId}' was not found or is currently inactive.`,
        });
      }
    }

    // ── Duplicate Inquiry Policy (Within last 5 minutes) ───────────────────
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingDuplicate = await prisma.inquiry.findFirst({
      where: {
        customerEmail: customerEmail.trim().toLowerCase(),
        subject: { equals: subject.trim(), mode: "insensitive" },
        createdAt: { gte: fiveMinutesAgo },
      },
      select: INQUIRY_SELECT,
    });

    if (existingDuplicate) {
      return res.status(409).json({
        success: false,
        error: "Conflict",
        message:
          "A duplicate inquiry with this subject from this customer was already submitted within the last 5 minutes.",
        data: existingDuplicate,
      });
    }

    const ticketNumber = await generateTicketNumber();
    const actorId = req.user?.id || null;

    // ── Transactional create ─────────────────────────────────────────────────
    const inquiry = await prisma.$transaction(async (tx) => {
      const created = await tx.inquiry.create({
        data: {
          ticketNumber,
          subject: subject.trim(),
          description: description.trim(),
          status: "OPEN",
          priority,
          channel,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim().toLowerCase(),
          customerPhone: customerPhone?.trim() || null,
          customerCompany: customerCompany?.trim() || null,
          createdById: actorId,
          assignedToId: assignedToId || null,
          categoryId: categoryId || null,
          // Optionally create first message in the same transaction
          ...(initialMessage && initialMessage.trim()
            ? {
                messages: {
                  create: {
                    senderName: customerName.trim(),
                    body: initialMessage.trim(),
                    isInternalNote: false,
                  },
                },
              }
            : {}),
        },
        select: INQUIRY_SELECT,
      });

      // Audit log: creation
      await logActivity(tx, {
        inquiryId: created.id,
        actorId,
        action: "INQUIRY_CREATED",
        newValue: "OPEN",
      });

      // Audit log: assignment (if set at creation)
      if (assignedToId) {
        const assignee = await tx.user.findUnique({
          where: { id: assignedToId },
          select: { name: true },
        });
        await logActivity(tx, {
          inquiryId: created.id,
          actorId,
          action: "ASSIGNED",
          oldValue: "Unassigned",
          newValue: assignee?.name || assignedToId,
        });
      }

      return created;
    });

    return res.status(201).json({
      success: true,
      message: `Inquiry ticket #${inquiry.ticketNumber} created successfully for ${inquiry.customerName} via ${inquiry.channel}.`,
      data: inquiry,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/inquiries/:id
 * Update an inquiry's fields. Only changed fields need to be sent.
 * Automatically records activity log entries for status, priority, and assignment changes.
 *
 * Updatable fields: subject, description, status, priority, channel,
 *                   categoryId, assignedToId,
 *                   customerName, customerEmail, customerPhone, customerCompany
 */
exports.updateInquiry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const actorId = req.user?.id || null;

    // Fetch current state to diff for activity logs
    const existing = await prisma.inquiry.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        priority: true,
        assignedToId: true,
        assignedTo: { select: { name: true } },
        resolvedAt: true,
        closedAt: true,
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: "Not Found",
        message: `Inquiry with id '${id}' does not exist.`,
      });
    }

    // ── RBAC Access Rule Enforcement ──────────────────────────────────────────
    // 1. ADMIN users can view, manage, and update all customer inquiries across the system.
    // 2. Staff users can only update inquiries assigned directly to them (or inquiries in 'OPEN' status).
    // If the user is Staff (and not an ADMIN) and the inquiry is not assigned to them (and not OPEN):
    // immediately reject the request with a 403 Forbidden status.
    const isAdmin = req.user?.role === "ADMIN";
    const isAssigned = Boolean(req.user?.id && existing.assignedToId === req.user.id);
    const isOpen = existing.status === "OPEN";

    if (!isAdmin) {
      // If the inquiry is assigned to another staff member, reject immediately with 403 Forbidden
      if (existing.assignedToId && existing.assignedToId !== req.user?.id) {
        return res.status(403).json({
          error: "Forbidden",
          message: "You are not authorized to update this inquiry. It is assigned to another staff member.",
        });
      }

      // If the inquiry is not assigned to the user and is not in 'OPEN' status, reject with 403 Forbidden
      if (!isAssigned && !isOpen) {
        return res.status(403).json({
          error: "Forbidden",
          message: "You are not authorized to update this inquiry. Staff can only update inquiries assigned directly to them or inquiries in OPEN status.",
        });
      }
    }

    const {
      subject,
      description,
      status,
      priority,
      channel,
      categoryId,
      assignedToId,
      customerName,
      customerEmail,
      customerPhone,
      customerCompany,
    } = req.body;

    // ── Granular Specific Access Permission Check ────────────────────────────
    const userPerms = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
    if (!isAdmin) {
      if (status !== undefined && !userPerms.includes("inquiries:update_status")) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "You do not have permission to update inquiry status.",
        });
      }
      if (priority !== undefined && !userPerms.includes("inquiries:update_priority")) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "You do not have permission to modify inquiry priority.",
        });
      }
      if (assignedToId !== undefined && !userPerms.includes("inquiries:assign")) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "You do not have permission to assign or reassign inquiries.",
        });
      }
    }

    // ── Validation ──────────────────────────────────────────────────────────
    const VALID_STATUSES = ["OPEN", "IN_PROGRESS", "PENDING_CUSTOMER", "RESOLVED", "CLOSED"];
    const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
    const VALID_CHANNELS = ["WEB_PORTAL", "EMAIL", "CHAT", "PHONE"];
    const errors = {};

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      errors.status = `Status must be one of: ${VALID_STATUSES.join(", ")}.`;
    }
    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
      errors.priority = `Priority must be one of: ${VALID_PRIORITIES.join(", ")}.`;
    }
    if (channel !== undefined && !VALID_CHANNELS.includes(channel)) {
      errors.channel = `Channel must be one of: ${VALID_CHANNELS.join(", ")}.`;
    }
    if (customerEmail !== undefined && customerEmail.trim() &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
      errors.customerEmail = "Customer email is not a valid email address.";
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        error: "Validation Error",
        message: Object.values(errors)[0] || "Invalid update fields.",
        details: errors,
      });
    }

    // ── Workflow Rule 1: Closed records are final and immutable ────────────
    if (existing.status === "CLOSED") {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Inquiry is CLOSED. Closed inquiries are final and cannot be modified or reopened.",
      });
    }

    // ── Workflow Rule 2: State transition enforcement ─────────────────────
    if (status !== undefined && status !== existing.status) {
      const allowedNext = ALLOWED_STATUS_TRANSITIONS[existing.status] || [];
      if (!allowedNext.includes(status)) {
        return res.status(400).json({
          success: false,
          error: "Bad Request",
          message: `Invalid status transition from '${existing.status}' to '${status}'. Allowed transitions: ${allowedNext.length > 0 ? allowedNext.join(", ") : "None (closed records are final)"}.`,
        });
      }
    }

    // ── Foreign-key validation ───────────────────────────────────────────────
    if (categoryId !== undefined && categoryId !== null) {
      const category = await prisma.category.findUnique({ where: { id: categoryId } });
      if (!category) {
        return res.status(400).json({
          success: false,
          error: "Validation Error",
          message: "Category not found.",
        });
      }
    }
    if (assignedToId !== undefined && assignedToId !== null) {
      const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
      if (!assignee || !assignee.isActive) {
        return res.status(400).json({
          success: false,
          error: "Validation Error",
          message: "Assigned user not found or is inactive.",
        });
      }
    }

    // ── Determine timestamp overrides for status transitions ─────────────────
    const timestampUpdates = {};
    if (status === "RESOLVED" && !existing.resolvedAt) {
      timestampUpdates.resolvedAt = new Date();
    }
    if (status === "CLOSED" && !existing.closedAt) {
      timestampUpdates.closedAt = new Date();
    }

    // Build update payload — only include defined fields
    const updateData = { ...timestampUpdates };
    if (subject !== undefined) updateData.subject = subject.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (channel !== undefined) updateData.channel = channel;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId;
    if (customerName !== undefined) updateData.customerName = customerName.trim();
    if (customerEmail !== undefined) updateData.customerEmail = customerEmail.trim().toLowerCase();
    if (customerPhone !== undefined) updateData.customerPhone = customerPhone?.trim() || null;
    if (customerCompany !== undefined) updateData.customerCompany = customerCompany?.trim() || null;

    // ── Transactional update with audit logs ─────────────────────────────────
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.inquiry.update({
        where: { id },
        data: updateData,
        select: INQUIRY_SELECT,
      });

      // Log status change
      if (status !== undefined && status !== existing.status) {
        await logActivity(tx, {
          inquiryId: id,
          actorId,
          action: "STATUS_CHANGED",
          oldValue: existing.status,
          newValue: status,
        });
      }

      // Log priority change
      if (priority !== undefined && priority !== existing.priority) {
        await logActivity(tx, {
          inquiryId: id,
          actorId,
          action: "PRIORITY_CHANGED",
          oldValue: existing.priority,
          newValue: priority,
        });
      }

      // Log assignment change
      if (assignedToId !== undefined && assignedToId !== existing.assignedToId) {
        let newAssigneeName = "Unassigned";
        if (assignedToId) {
          const newAssignee = await tx.user.findUnique({
            where: { id: assignedToId },
            select: { name: true },
          });
          newAssigneeName = newAssignee?.name || assignedToId;
        }
        await logActivity(tx, {
          inquiryId: id,
          actorId,
          action: "ASSIGNED",
          oldValue: existing.assignedTo?.name || "Unassigned",
          newValue: newAssigneeName,
        });
      }

      return result;
    });

    // Construct custom tailored success message based on what was updated
    let customUpdateMessage = `Ticket #${existing.ticketNumber} updated successfully.`;
    if (status !== undefined && status !== existing.status) {
      customUpdateMessage = `Ticket #${existing.ticketNumber} status successfully updated from ${existing.status} to ${status}.`;
    } else if (priority !== undefined && priority !== existing.priority) {
      customUpdateMessage = `Ticket #${existing.ticketNumber} priority level adjusted to ${priority}.`;
    } else if (assignedToId !== undefined && assignedToId !== existing.assignedToId) {
      customUpdateMessage = updated.assignedTo
        ? `Ticket #${existing.ticketNumber} reassigned to ${updated.assignedTo.name} (${updated.assignedTo.department || "Operations"}).`
        : `Ticket #${existing.ticketNumber} unassigned and returned to the triage queue.`;
    }

    return res.status(200).json({
      success: true,
      message: customUpdateMessage,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/inquiries/:id
 * Soft-close (status → CLOSED) or hard-delete for ADMIN role only.
 * Query param: ?hardDelete=true (ADMIN only)
 */
exports.deleteInquiry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const hardDelete = req.query.hardDelete === "true";

    const existing = await prisma.inquiry.findUnique({
      where: { id },
      select: { id: true, ticketNumber: true, status: true, assignedToId: true },
    });

    if (!existing) {
      return res.status(404).json({
        error: "Not Found",
        message: `Inquiry with id '${id}' does not exist.`,
      });
    }

    // Hard delete is restricted to ADMIN
    if (hardDelete) {
      if (req.user?.role !== "ADMIN") {
        return res.status(403).json({
          error: "Forbidden",
          message: "Only administrators can permanently delete inquiries.",
        });
      }
      await prisma.inquiry.delete({ where: { id } });
      return res.status(200).json({
        success: true,
        message: `Inquiry ticket #${existing.ticketNumber} has been permanently deleted from the database.`,
      });
    }

    // RBAC: Staff users can only close inquiries assigned to them or unassigned
    if (req.user?.role !== "ADMIN") {
      if (!(Array.isArray(req.user?.permissions) && req.user.permissions.includes("inquiries:close"))) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "You do not have permission to close inquiries.",
        });
      }

      if (existing.assignedToId && existing.assignedToId !== req.user?.id) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: `You are not authorized to close inquiry #${existing.ticketNumber}. It is assigned to another staff member.`,
        });
      }
    }

    // Workflow Rule: Closed inquiries cannot be closed again; must be RESOLVED before CLOSED
    if (existing.status === "CLOSED") {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: `Inquiry #${existing.ticketNumber} is already CLOSED. Closed inquiries are final and cannot be modified or reopened.`,
      });
    }

    if (existing.status !== "RESOLVED") {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: `Cannot close inquiry #${existing.ticketNumber} with status '${existing.status}'. Inquiries must be in 'RESOLVED' status before they can be closed.`,
      });
    }

    // Default: soft-close
    await prisma.$transaction(async (tx) => {
      await tx.inquiry.update({
        where: { id },
        data: { status: "CLOSED", closedAt: new Date() },
      });
      await logActivity(tx, {
        inquiryId: id,
        actorId: req.user?.id || null,
        action: "STATUS_CHANGED",
        oldValue: existing.status,
        newValue: "CLOSED",
      });
    });

    return res.status(200).json({
      success: true,
      message: `Inquiry ticket #${existing.ticketNumber} has been officially closed and archived.`,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Messages ─────────────────────────────────────────────────────────────────

/**
 * POST /api/inquiries/:id/messages
 * Add a message (or internal note) to an inquiry thread.
 *
 * Body: body (string, required), isInternalNote? (boolean, default false)
 */
exports.addMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { body, isInternalNote = false } = req.body;

    if (!body || !body.trim()) {
      return res.status(400).json({
        success: false,
        error: "Validation Error",
        message: "Message body cannot be empty. Please provide content before submitting.",
      });
    }

    const inquiry = await prisma.inquiry.findUnique({
      where: { id },
      select: { id: true, ticketNumber: true, status: true, assignedToId: true },
    });

    if (!inquiry) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: `Inquiry with id '${id}' does not exist in the database.`,
      });
    }

    // RBAC: Staff cannot add messages or notes to inquiries assigned to another staff member
    if (req.user?.role !== "ADMIN" && inquiry.assignedToId && inquiry.assignedToId !== req.user?.id) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: `You are not authorized to add messages or notes to inquiry #${inquiry.ticketNumber}. It is assigned to another staff member.`,
      });
    }

    if (inquiry.status === "CLOSED") {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: `Inquiry #${inquiry.ticketNumber} is CLOSED. Discussion is locked and cannot receive new messages or notes.`,
      });
    }

    const actorId = req.user?.id || null;
    const senderName = req.user?.name || "Staff";

    const message = await prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          inquiryId: id,
          senderId: actorId,
          senderName,
          body: body.trim(),
          isInternalNote: Boolean(isInternalNote),
        },
        select: {
          id: true,
          senderName: true,
          body: true,
          isInternalNote: true,
          createdAt: true,
          sender: { select: { id: true, name: true, email: true } },
        },
      });

      // If agent replies and status is still OPEN, auto-progress to IN_PROGRESS
      if (inquiry.status === "OPEN" && actorId && !Boolean(isInternalNote)) {
        await tx.inquiry.update({ where: { id }, data: { status: "IN_PROGRESS" } });
        await logActivity(tx, {
          inquiryId: id,
          actorId,
          action: "STATUS_CHANGED",
          oldValue: "OPEN",
          newValue: "IN_PROGRESS",
        });
      }

      await logActivity(tx, {
        inquiryId: id,
        actorId,
        action: Boolean(isInternalNote) ? "INTERNAL_NOTE_ADDED" : "MESSAGE_ADDED",
        newValue: body.trim().substring(0, 100),
      });

      return msg;
    });

    const customMsg = Boolean(isInternalNote)
      ? `Internal note added to inquiry #${inquiry.ticketNumber} by ${senderName}.`
      : `Customer response recorded for inquiry #${inquiry.ticketNumber}.`;

    return res.status(201).json({
      success: true,
      message: customMsg,
      data: message,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Stats ────────────────────────────────────────────────────────────────────

/**
 * GET /api/inquiries/stats
 * Returns dashboard-ready aggregate counts:
 *   total, by status, by priority, unassigned, resolvedToday
 */
exports.getStats = async (req, res, next) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      total,
      byStatus,
      byPriority,
      unassigned,
      resolvedToday,
    ] = await Promise.all([
      prisma.inquiry.count(),
      prisma.inquiry.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.inquiry.groupBy({ by: ["priority"], _count: { _all: true } }),
      prisma.inquiry.count({ where: { assignedToId: null, status: { notIn: ["CLOSED", "RESOLVED"] } } }),
      prisma.inquiry.count({ where: { resolvedAt: { gte: todayStart } } }),
    ]);

    // Shape status counts into a flat object for easy consumption
    const statusCounts = Object.fromEntries(
      byStatus.map((r) => [r.status, r._count._all])
    );
    const priorityCounts = Object.fromEntries(
      byPriority.map((r) => [r.priority, r._count._all])
    );

    return res.status(200).json({
      data: {
        total,
        unassigned,
        resolvedToday,
        byStatus: {
          OPEN: statusCounts.OPEN || 0,
          IN_PROGRESS: statusCounts.IN_PROGRESS || 0,
          PENDING_CUSTOMER: statusCounts.PENDING_CUSTOMER || 0,
          RESOLVED: statusCounts.RESOLVED || 0,
          CLOSED: statusCounts.CLOSED || 0,
        },
        byPriority: {
          LOW: priorityCounts.LOW || 0,
          MEDIUM: priorityCounts.MEDIUM || 0,
          HIGH: priorityCounts.HIGH || 0,
          URGENT: priorityCounts.URGENT || 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
