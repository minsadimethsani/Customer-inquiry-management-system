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

    // Validate input fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Validation Error",
        message: "Email and password are required.",
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
        message: "Invalid email or password.",
      });
    }

    // Check account active status
    if (user.isActive === false) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Account has been deactivated. Please contact an administrator.",
      });
    }

    // Retrieve stored password hash (supports both camelCase passwordHash and snake_case password_hash)
    const storedHash = user.passwordHash || user.password_hash;

    if (!storedHash) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Authentication failed. No password configured for this user.",
      });
    }

    // Verify submitted password against stored hash using bcryptjs
    const isPasswordValid = await bcrypt.compare(password, storedHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Invalid email or password.",
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
    };

    const token = jwt.sign(payload, jwtSecret, { expiresIn });

    // Return token and basic user details
    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || null,
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
