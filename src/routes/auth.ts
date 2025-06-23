import { Router, Response, Request } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { database } from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import { validateUserRegistration, validateUserLogin } from '../middleware/validation';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', validateUserRegistration, asyncHandler(async (req: Request, res: Response) => {
  const { email, password, first_name, last_name } = req.body;

  // Check if user already exists
  const existingUser = await database.query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );

  if (existingUser.rows.length > 0) {
    return res.status(409).json({
      success: false,
      error: { message: 'User already exists with this email' },
    });
  }

  // Hash password
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Create user
  const result = await database.query(
    `INSERT INTO users (email, password_hash, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, first_name, last_name, created_at`,
    [email, passwordHash, first_name || null, last_name || null]
  );

  const user = result.rows[0];

  // Create default subscription
  await database.query(
    `INSERT INTO subscriptions (user_id, plan, status, current_period_start, current_period_end)
     VALUES ($1, 'starter', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 month')`,
    [user.id]
  );

  // Create default notification settings
  await database.query(
    `INSERT INTO notification_settings (user_id, email_enabled)
     VALUES ($1, true)`,
    [user.id]
  );

  // Generate JWT token
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }
  
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  );

  logger.info('User registered successfully', { userId: user.id, email: user.email });

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        created_at: user.created_at,
      },
      token,
    },
    message: 'User registered successfully',
  });
}));

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', validateUserLogin, asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Get user with password hash
  const result = await database.query(
    'SELECT id, email, password_hash, first_name, last_name FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid email or password' },
    });
  }

  const user = result.rows[0];

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid email or password' },
    });
  }

  // Update last login
  await database.query(
    'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
    [user.id]
  );

  // Generate JWT token
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }
  
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  );

  logger.info('User logged in successfully', { userId: user.id, email: user.email });

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      },
      token,
    },
    message: 'Login successful',
  });
}));

/**
 * GET /api/auth/profile
 * Get user profile
 */
router.get('/profile', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  // Get user with subscription info
  const result = await database.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.is_verified, u.created_at,
            s.plan, s.status as subscription_status, s.current_period_end
     FROM users u
     LEFT JOIN subscriptions s ON u.id = s.user_id
     WHERE u.id = $1`,
    [(req as AuthenticatedRequest).user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: { message: 'User not found' },
    });
  }

  const user = result.rows[0];

  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      is_verified: user.is_verified,
      created_at: user.created_at,
      subscription: {
        plan: user.plan,
        status: user.subscription_status,
        current_period_end: user.current_period_end,
      },
    },
  });
}));

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put('/profile', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { first_name, last_name } = req.body;

  const result = await database.query(
    `UPDATE users 
     SET first_name = $1, last_name = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $3
     RETURNING id, email, first_name, last_name`,
    [first_name || null, last_name || null, (req as AuthenticatedRequest).user.id]
  );

  const user = result.rows[0];

  logger.info('User profile updated', { userId: (req as AuthenticatedRequest).user.id });

  res.json({
    success: true,
    data: user,
    message: 'Profile updated successfully',
  });
}));

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post('/change-password', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      error: { message: 'Current password and new password are required' },
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      error: { message: 'New password must be at least 8 characters long' },
    });
  }

  // Get current password hash
  const result = await database.query(
    'SELECT password_hash FROM users WHERE id = $1',
    [(req as AuthenticatedRequest).user.id]
  );

  const user = result.rows[0];

  // Verify current password
  const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValidPassword) {
    return res.status(401).json({
      success: false,
      error: { message: 'Current password is incorrect' },
    });
  }

  // Hash new password
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
  const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

  // Update password
  await database.query(
    'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [newPasswordHash, (req as AuthenticatedRequest).user.id]
  );

  logger.info('User password changed', { userId: (req as AuthenticatedRequest).user.id });

  res.json({
    success: true,
    message: 'Password changed successfully',
  });
}));

export default router;
