import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { database } from './config/database';
import { redis } from './config/redis';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';

// Import routes
import authRoutes from './routes/auth';
import agentRoutes from './routes/agents';

// Import services
import { AgentService } from './services/AgentService';
import { MonitoringService } from './services/MonitoringService';
import { NotificationService } from './services/NotificationService';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  // Handle monitoring service connections
  monitoringService.handleConnection(socket);

  socket.on('join-agent-room', (agentId: string) => {
    socket.join(`agent-${agentId}`);
    logger.info(`Client ${socket.id} joined agent room: ${agentId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });

  socket.on('error', (error) => {
    logger.error('Socket error', { socketId: socket.id, error });
  });
});

// Error handling middleware
app.use(errorHandler);

// Initialize services
const agentService = new AgentService();
const monitoringService = new MonitoringService(io);
const notificationService = new NotificationService();

// Make services available to routes
app.locals.agentService = agentService;
app.locals.monitoringService = monitoringService;
app.locals.notificationService = notificationService;

async function startServer() {
  try {
    // Test database connection
    await database.query('SELECT 1');
    logger.info('Database connection established');

    // Test Redis connection
    await redis.ping();
    logger.info('Redis connection established');

    // Start monitoring service
    await monitoringService.startMonitoring();

    // Start server
    server.listen(PORT, () => {
      logger.info(`🚀 Mentis Protocol Backend started on port ${PORT}`);
      logger.info(`🤖 AI agents powered by LangChain v0.3`);
      logger.info(`📊 Real-time monitoring and alerts enabled`);
      logger.info(`🔗 Multi-chain support: Ethereum, Solana, Cosmos`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

startServer();
