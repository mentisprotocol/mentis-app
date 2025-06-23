import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

// General rate limiter
export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      message: 'Too many requests from this IP, please try again later.',
    },
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
    });
    res.status(429).json({
      success: false,
      error: {
        message: 'Too many requests from this IP, please try again later.',
      },
    });
  },
});

// Strict rate limiter for authentication endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs for auth endpoints
  message: {
    success: false,
    error: {
      message: 'Too many authentication attempts, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
    });
    res.status(429).json({
      success: false,
      error: {
        message: 'Too many authentication attempts, please try again later.',
      },
    });
  },
});

// API rate limiter for general API endpoints
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs for API endpoints
  message: {
    success: false,
    error: {
      message: 'API rate limit exceeded, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// WebSocket rate limiter (for Socket.IO events)
export const createWebSocketRateLimiter = (maxEvents: number = 100, windowMs: number = 60000) => {
  const clients = new Map<string, { count: number; resetTime: number }>();

  return (socketId: string): boolean => {
    const now = Date.now();
    const client = clients.get(socketId);

    if (!client || now > client.resetTime) {
      clients.set(socketId, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (client.count >= maxEvents) {
      logger.warn('WebSocket rate limit exceeded', { socketId });
      return false;
    }

    client.count++;
    return true;
  };
};

