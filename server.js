const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const uploadRoutes = require("./routes/upload");
const modelsRoutes = require("./routes/models");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB
mongoose.connect("mongodb://localhost:27017/walrus_auth", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
mongoose.connection.once("open", () => console.log("Connected to MongoDB 🚀"));

// Static file serving for uploaded models
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api", authRoutes);
app.use("/api", uploadRoutes);
app.use("/api", modelsRoutes);
app.use(
  "/model-metadata",
  express.static(path.join(__dirname, "public", "model-metadata"))
);
app.get("/api", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>VisionaryAI Backend</title>
      </head>
      <body>
        <h1>Welcome to VisionaryAI Backend</h1>
        <p>The server is running successfully.</p>
        <p>Use the API endpoints to interact with the system.</p>
      </body>
    </html>
  `);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
