require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const axios = require('axios');

const authRoutes = require('./routes/authRoutes');
const bookRoutes = require('./routes/bookRoutes');
const issueRoutes = require('./routes/issueRoutes');
const fineRoutes = require('./routes/fineRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Connect DB
connectDB();

const app = express();
const httpServer = http.createServer(app);

// ── CORS: support comma-separated list of allowed origins ──────────────────
// On Render set CLIENT_URL=https://yourfrontend.com,http://localhost:5173
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173' || 'https://ku-library-management-frontend.onrender.com')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server (no origin) and listed origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
};

// Socket.io
const io = new Server(httpServer, { cors: corsOptions });

io.on('connection', (socket) => {
  socket.on('join', (userId) => {
    if (userId) socket.join(userId);
  });
  socket.on('disconnect', () => { });
});

// Export io for use in controllers
app.set('io', io);

// Security & Middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Routes
app.get('/', (req, res) => {
  console.log('API request:', req.method, req.url);
  res.json({ message: 'Library Management API' });
});
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/fines', fineRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

app.use("/api", require("./routes/ping_routes"));

// Error handlers
app.use(notFound);
app.use(errorHandler);

// Cron jobs (loaded after server starts)
require('./cron/fineJob');
require('./cron/reminderJob');

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server listening at:`);
  console.log(`→ http://localhost:${PORT}`);
  setInterval(async () => {
    try {
      await axios.get('https://ku-library-management-backend.onrender.com/api/ping');
      console.log(`[AutoPing] Successful at ${new Date().toISOString()}`);
    } catch (err) {
      console.error('[AutoPing] Failed:', err.message);
    }
  }, 10 * 60 * 1000); // 10 minutes
});

module.exports = { app, io };
