const jwt = require("jsonwebtoken");

/**
 * Authentication Middleware
 * Extracts and verifies the JWT token from Authorization: Bearer <token> header.
 * Attaches the decoded user object to req.user on success.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  // Check for presence of Authorization header
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
      message: "Access denied. No authorization header provided.",
    });
  }

  // Header must follow format: "Bearer <token>"
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
      message: "Invalid authorization header format. Expected 'Bearer <token>'.",
    });
  }

  const token = parts[1];
  const jwtSecret = process.env.JWT_SECRET || "pulsedesk_default_jwt_secret";

  try {
    // Verify token using jsonwebtoken
    const decoded = jwt.verify(token, jwtSecret);

    // Attach decoded user payload (id, name, email, role) to req.user
    req.user = decoded;
    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Authentication token has expired. Please log in again.",
      });
    }

    return res.status(401).json({
      success: false,
      error: "Unauthorized",
      message: "Invalid or malformed authentication token.",
    });
  }
}

/**
 * Optional Role-based authorization guard
 * Usage: router.get('/admin-only', authenticate, authorizeRoles('ADMIN'), handler);
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "You do not have permission to perform this action.",
      });
    }
    next();
  };
}

module.exports = {
  authenticate,
  authorizeRoles,
};
