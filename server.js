const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/walrus_auth', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
mongoose.connection.once('open', () =>
  console.log('Connected to MongoDB 🚀')
);

// Routes
app.use('/api', authRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

