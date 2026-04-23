const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const dotenv = require('dotenv');

// Load .env using absolute path so it works regardless of CWD
dotenv.config({ path: path.resolve(__dirname, '.env') });

const connectDB = require('./config/db');
const mongoose = require('mongoose');

// Connect to Database
connectDB();

const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const adminRoutes = require('./routes/adminRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const utilsRoutes = require('./routes/utilsRoutes');

const app = express();

// Middleware
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'https://ethree-login.vercel.app'
    ],
    credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// Removed: DB connection middleware for Vercel


// Health check endpoint
app.get('/api/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState;
    const dbStatusMap = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
    };

    res.json({
        status: 'ok',
        database: dbStatusMap[dbStatus] || 'unknown',
        uptime: process.uptime(),
        environment: {
            hasMongoUri: !!process.env.MONGODB_URI,
            hasJwtSecret: !!process.env.JWT_SECRET,
            nodeEnv: process.env.NODE_ENV
        },
        timestamp: new Date().toISOString()
    });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/utils', utilsRoutes);

app.get('/', (req, res) => {
    res.send('Employee Work Monitoring API is running...');
});

// 404 handler for undefined routes
app.use((req, res, next) => {
    const err = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(err);
});

// Global Error Handler
app.use((err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    console.error(`Error ${statusCode}: ${err.message}`);
    console.error(err.stack);

    res.status(statusCode).json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
    });
});

const http = require('http');
const { Server } = require("socket.io");

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: [
            'http://localhost:5173',
            'http://localhost:5174',
            'https://track.stackvil.com'
        ],
        credentials: true
    }
});

// Socket.io connection
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('join_room', (emp_no) => {
        socket.join(emp_no);
        console.log(`Socket ${socket.id} joined room: ${emp_no}`);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Make io accessible in routes
app.set('io', io);

// Initialize Scheduler
const initScheduler = require('./scheduler');
initScheduler(io);

const PORT = process.env.PORT || 5000;

if (!process.env.VERCEL) {
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
}

module.exports = app;
