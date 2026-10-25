const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");

const ALL_PERMISSIONS = [
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

const DEFAULT_AGENT_PERMISSIONS = [
  "inquiries:create",
  "inquiries:update_status",
  "inquiries:assign",
  "inquiries:update_priority",
  "inquiries:add_notes",
  "inquiries:close",
  "inquiries:view_all",
];

/**
 * List all staff accounts
 * GET /api/staff
 * If user is ADMIN: returns all staff with permissions, active status, and metadata.
 * If user is AGENT: returns active staff for assignee dropdowns.
 */
exports.listStaff = async (req, res, next) => {
  try {
    const isAdmin = req.user?.role === "ADMIN";

    if (isAdmin) {
      const staffList = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: true,
          avatarUrl: true,
          isActive: true,
          permissions: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
      });

      return res.status(200).json({
        success: true,
        data: staffList,
      });
    }

    // For non-admin agents, return active staff for assignment selection
    const staffList = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        avatarUrl: true,
      },
      orderBy: { name: "asc" },
    });

    return res.status(200).json({
      success: true,
      data: staffList,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new staff account with specific access permissions
 * POST /api/staff
 * Protected: ADMIN only
 * Body: { name, email, password, role, department, permissions }
 */
exports.createStaff = async (req, res, next) => {
  try {
    const { name, email, password, role = "AGENT", department, permissions } = req.body;

    // Validation with custom descriptive messages
    const errors = {};

    if (!name || !name.trim()) {
      errors.name = "Staff member full name is required for account creation.";
    }

    if (!email || !email.trim()) {
      errors.email = "Corporate work email is required for staff authentication.";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        errors.email = `'${email.trim()}' is not a valid work email address format.`;
      }
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      errors.password = "Staff account password must be at least 6 characters long for system security.";
    }

    const validRoles = ["ADMIN", "AGENT"];
    if (role && !validRoles.includes(role)) {
      errors.role = `Assigned role '${role}' is invalid. Allowed roles are: ${validRoles.join(", ")}.`;
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        error: "Validation Error",
        message: Object.values(errors)[0],
        details: errors,
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user with this email already exists
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: "Conflict",
        message: `A staff account with email '${normalizedEmail}' already exists.`,
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Determine permissions:
    // If ADMIN role: gets all permissions automatically.
    // If AGENT role: uses provided permissions array or defaults.
    let grantedPermissions = [];
    if (role === "ADMIN") {
      grantedPermissions = ALL_PERMISSIONS;
    } else if (Array.isArray(permissions)) {
      // Filter to only recognized permissions
      grantedPermissions = permissions.filter((p) => ALL_PERMISSIONS.includes(p));
    } else {
      grantedPermissions = DEFAULT_AGENT_PERMISSIONS;
    }

    // Create staff account in PostgreSQL
    const newStaff = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role,
        department: department?.trim() || null,
        permissions: grantedPermissions,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        permissions: true,
        isActive: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: `Staff account for ${newStaff.name} created successfully with specific access permissions.`,
      data: newStaff,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update staff account details, active status, or permissions
 * PATCH /api/staff/:id
 * Protected: ADMIN only
 * Body: { name?, department?, role?, isActive?, permissions? }
 */
exports.updateStaff = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, department, role, isActive, permissions } = req.body;

    const existing = await prisma.user.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: `Staff user with id '${id}' does not exist.`,
      });
    }

    // Safety: Prevent an Admin from deactivating their own account
    if (id === req.user.id && isActive === false) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "You cannot deactivate your own administrative account.",
      });
    }

    const updateData = {};

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          error: "Validation Error",
          message: "Name cannot be empty.",
        });
      }
      updateData.name = name.trim();
    }

    if (department !== undefined) {
      updateData.department = department ? department.trim() : null;
    }

    if (role !== undefined) {
      if (!["ADMIN", "AGENT"].includes(role)) {
        return res.status(400).json({
          success: false,
          error: "Validation Error",
          message: "Role must be 'ADMIN' or 'AGENT'.",
        });
      }
      updateData.role = role;
    }

    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    if (permissions !== undefined) {
      if (!Array.isArray(permissions)) {
        return res.status(400).json({
          success: false,
          error: "Validation Error",
          message: "Permissions must be an array of permission keys.",
        });
      }
      // If updating to ADMIN, grant all permissions
      if ((role || existing.role) === "ADMIN") {
        updateData.permissions = ALL_PERMISSIONS;
      } else {
        updateData.permissions = permissions.filter((p) => ALL_PERMISSIONS.includes(p));
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        permissions: true,
        isActive: true,
        updatedAt: true,
      },
    });

    // Custom tailored message based on what property was updated
    let customSuccessMessage = `Staff account for ${updated.name} updated successfully.`;
    if (isActive !== undefined) {
      customSuccessMessage = updated.isActive
        ? `Staff account for ${updated.name} has been reactivated. Login access restored.`
        : `Staff account for ${updated.name} has been deactivated. Login access suspended.`;
    } else if (permissions !== undefined) {
      customSuccessMessage = `Access permissions for ${updated.name} updated: ${updated.permissions.length} granular permission(s) active.`;
    } else if (role !== undefined) {
      customSuccessMessage = `Role for staff member ${updated.name} updated to '${updated.role}'.`;
    } else if (department !== undefined) {
      customSuccessMessage = `Department for ${updated.name} assigned to '${updated.department || "Unassigned"}'.`;
    }

    return res.status(200).json({
      success: true,
      message: customSuccessMessage,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};
