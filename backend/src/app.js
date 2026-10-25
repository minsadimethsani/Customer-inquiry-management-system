const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const inquiryRoutes = require("./routes/inquiryRoutes");
const staffRoutes = require("./routes/staffRoutes");
const prisma = require("./lib/prisma");

const app = express();

// Cross-Origin Resource Sharing
app.use(cors());

// Request Body Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "PulseDesk Backend API",
    timestamp: new Date().toISOString(),
  });
});

// Authentication Routes
app.use("/api/auth", authRoutes);

// Inquiry Routes
app.use("/api/inquiries", inquiryRoutes);

// Categories — lightweight reference list for dropdowns (authenticated)
const { authenticate } = require("./middleware/auth");
app.get("/api/categories", authenticate, async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true, color: true, description: true },
      orderBy: { name: "asc" },
    });
    res.status(200).json({ data: categories });
  } catch (err) {
    next(err);
  }
});

// Staff Management Routes
app.use("/api/staff", staffRoutes);

// 404 Route Not Found Handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: "Not Found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Centralized Global Error Handler
app.use((err, req, res, next) => {
  console.error("Server Error:", err);

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    error: err.name || "ServerError",
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

module.exports = app;
