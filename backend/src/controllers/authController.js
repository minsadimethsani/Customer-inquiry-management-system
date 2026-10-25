const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

/**
 * Login Handler - POST /api/auth/login
 * Authenticates user credentials against the PostgreSQL users table and returns a JWT token.
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate input fields with custom messages
    const errors = {};
    if (!email || !email.trim()) {
      errors.email = "Work email address is required to sign in.";
    }
    if (!password) {
      errors.password = "Password is required to authenticate your identity.";
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        error: "Validation Error",
        message:
          !email && !password
            ? "Please provide both your work email and password to sign in."
            : Object.values(errors)[0],
        details: errors,
      });
    }

    // Query user by email from PostgreSQL users table
    const user = await prisma.user.findUnique({
      where: {
        email: email.trim().toLowerCase(),
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Authentication failed. No active staff account matches the provided email address.",
      });
    }

    // Check account active status
    if (user.isActive === false) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: `Account for '${user.email}' is currently deactivated. Please contact a system administrator.`,
      });
    }

    // Retrieve stored password hash (supports both camelCase passwordHash and snake_case password_hash)
    const storedHash = user.passwordHash || user.password_hash;

    if (!storedHash) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Authentication failed. No password credentials have been configured for this user.",
      });
    }

    // Verify submitted password against stored hash using bcryptjs
    const isPasswordValid = await bcrypt.compare(password, storedHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Authentication failed. The password entered does not match our records.",
      });
    }

    // Sign JWT token
    const jwtSecret = process.env.JWT_SECRET || "pulsedesk_default_jwt_secret";
    const expiresIn = process.env.JWT_EXPIRES_IN || "24h";

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions || [],
    };

    const token = jwt.sign(payload, jwtSecret, { expiresIn });

    // Return token and basic user details with custom tailored message
    return res.status(200).json({
      message: `Authentication successful. Welcome, ${user.name} (${user.role} - ${user.department || "Operations Desk"}).`,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || null,
        avatarUrl: user.avatarUrl || null,
        permissions: user.permissions || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Current User Profile Handler - GET /api/auth/me
 * Returns the currently authenticated user's profile from req.user
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        avatarUrl: true,
        permissions: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: "User profile no longer exists.",
      });
    }

    return res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};
