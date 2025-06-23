import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { SupportedChain, NodeType } from '../types';

// Agent creation validation schema
const agentCreationSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).optional(),
  chain: Joi.string().valid(...Object.values(SupportedChain)).required(),
  node_type: Joi.string().valid(...Object.values(NodeType)).required(),
  endpoint_url: Joi.string().uri().required(),
  config: Joi.object({
    llmProvider: Joi.string().valid('openai', 'anthropic').default('openai'),
    model: Joi.string().default('gpt-4o-mini'),
    systemPrompt: Joi.string().optional(),
    tools: Joi.array().items(Joi.string()).default(['health_check', 'collect_metrics', 'create_alert']),
    maxIterations: Joi.number().integer().min(1).max(50).default(10),
    temperature: Joi.number().min(0).max(2).default(0.1),
  }).optional(),
});

// Agent update validation schema
const agentUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  description: Joi.string().max(1000).optional(),
  endpoint_url: Joi.string().uri().optional(),
  config: Joi.object({
    llmProvider: Joi.string().valid('openai', 'anthropic').optional(),
    model: Joi.string().optional(),
    systemPrompt: Joi.string().optional(),
    tools: Joi.array().items(Joi.string()).optional(),
    maxIterations: Joi.number().integer().min(1).max(50).optional(),
    temperature: Joi.number().min(0).max(2).optional(),
  }).optional(),
  status: Joi.string().valid('active', 'inactive', 'error', 'maintenance').optional(),
});

// User registration validation schema
const userRegistrationSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  first_name: Joi.string().min(1).max(100).optional(),
  last_name: Joi.string().min(1).max(100).optional(),
});

// User login validation schema
const userLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// Subscription update validation schema
const subscriptionUpdateSchema = Joi.object({
  plan: Joi.string().valid('starter', 'core', 'enterprise').required(),
});

// Notification settings validation schema
const notificationSettingsSchema = Joi.object({
  email_enabled: Joi.boolean().optional(),
  slack_webhook_url: Joi.string().uri().allow('').optional(),
  telegram_chat_id: Joi.string().allow('').optional(),
  webhook_url: Joi.string().uri().allow('').optional(),
  alert_thresholds: Joi.object({
    uptime_threshold: Joi.number().min(0).max(100).optional(),
    response_time_threshold: Joi.number().min(0).optional(),
    error_rate_threshold: Joi.number().min(0).max(100).optional(),
  }).optional(),
});

/**
 * Generic validation middleware factory
 */
const createValidationMiddleware = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation error',
          details: errorDetails,
        },
      });
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
};

/**
 * Query parameter validation middleware
 */
const validateQueryParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        error: {
          message: 'Query parameter validation error',
          details: errorDetails,
        },
      });
    }

    req.query = value;
    next();
  };
};

/**
 * UUID parameter validation middleware
 */
const validateUUIDParam = (paramName: string) => {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const uuidSchema = Joi.string().uuid().required();
    const { error } = uuidSchema.validate(req.params[paramName]);

    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Invalid ${paramName} format`,
        },
      });
    }

    next();
  };
};

// Export validation middlewares
export const validateAgentCreation = createValidationMiddleware(agentCreationSchema);
export const validateAgentUpdate = createValidationMiddleware(agentUpdateSchema);
export const validateUserRegistration = createValidationMiddleware(userRegistrationSchema);
export const validateUserLogin = createValidationMiddleware(userLoginSchema);
export const validateSubscriptionUpdate = createValidationMiddleware(subscriptionUpdateSchema);
export const validateNotificationSettings = createValidationMiddleware(notificationSettingsSchema);

// Query parameter validation schemas
const metricsQuerySchema = Joi.object({
  hours: Joi.number().integer().min(1).max(168).default(24), // Max 7 days
  timeRange: Joi.string().valid('5m', '15m', '1h', '6h', '24h', '7d').default('1h'),
});

const alertsQuerySchema = Joi.object({
  resolved: Joi.boolean().default(false),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0),
});

export const validateMetricsQuery = validateQueryParams(metricsQuerySchema);
export const validateAlertsQuery = validateQueryParams(alertsQuerySchema);

// Parameter validation
export const validateAgentId = validateUUIDParam('id');
export const validateAlertId = validateUUIDParam('alertId');
export const validateUserId = validateUUIDParam('userId');

/**
 * Custom validation for agent task execution
 */
export const validateAgentTaskExecution = (req: Request, res: Response, next: NextFunction): void | Response => {
  const schema = Joi.object({
    taskType: Joi.string().valid('monitor', 'analyze', 'repair', 'optimize', 'alert').required(),
    description: Joi.string().min(1).max(1000).required(),
    parameters: Joi.object().optional(),
    priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
  });

  const { error, value } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Task validation error',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      },
    });
  }

  req.body = value;
  next();
};

/**
 * Sanitize HTML content to prevent XSS
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeString = (str: string): string => {
    return str
      .replace(/[<>]/g, '') // Remove < and > characters
      .trim();
  };

  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return sanitizeString(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    
    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};
