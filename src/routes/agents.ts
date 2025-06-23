import { Router, Response, Request } from 'express';
import { AgentService } from '../services/AgentService';
import { MonitoringService } from '../services/MonitoringService';
import { asyncHandler } from '../middleware/errorHandler';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { validateAgentCreation, validateAgentUpdate } from '../middleware/validation';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/agents
 * Get all agents for the authenticated user
 */
router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const agentService = req.app.locals.agentService as AgentService;
  const agents = await agentService.getAgentsByUserId((req as AuthenticatedRequest).user.id);
  
  res.json({
    success: true,
    data: agents,
  });
}));

/**
 * POST /api/agents
 * Create a new AI agent
 */
router.post('/', authMiddleware, validateAgentCreation, asyncHandler(async (req: Request, res: Response) => {
  const agentService = req.app.locals.agentService as AgentService;
  
  const agentData = {
    ...req.body,
    user_id: (req as AuthenticatedRequest).user.id,
  };

  const agent = await agentService.createAgent(agentData);
  
  logger.info('Agent created via API', { agentId: agent.id, userId: (req as AuthenticatedRequest).user.id });
  
  res.status(201).json({
    success: true,
    data: agent,
    message: 'AI agent created successfully',
  });
}));

/**
 * GET /api/agents/:id
 * Get agent details with AI status
 */
router.get('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const agentService = req.app.locals.agentService as AgentService;
  const agentId = req.params.id;
  
  const agentStatus = await agentService.getAgentStatus(agentId);
  
  if (!agentStatus) {
    return res.status(404).json({
      success: false,
      error: { message: 'Agent not found' },
    });
  }

  // Check if user owns this agent
  if (agentStatus.user_id !== (req as AuthenticatedRequest).user.id) {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied' },
    });
  }
  
  res.json({
    success: true,
    data: agentStatus,
  });
}));

/**
 * PUT /api/agents/:id
 * Update agent configuration
 */
router.put('/:id', authMiddleware, validateAgentUpdate, asyncHandler(async (req: Request, res: Response) => {
  const agentService = req.app.locals.agentService as AgentService;
  const agentId = req.params.id;
  
  // Check if agent exists and user owns it
  const existingAgent = await agentService.getAgentById(agentId);
  if (!existingAgent) {
    return res.status(404).json({
      success: false,
      error: { message: 'Agent not found' },
    });
  }

  if (existingAgent.user_id !== (req as AuthenticatedRequest).user.id) {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied' },
    });
  }
  
  const updatedAgent = await agentService.updateAgent(agentId, req.body);
  
  logger.info('Agent updated via API', { agentId, userId: (req as AuthenticatedRequest).user.id });
  
  res.json({
    success: true,
    data: updatedAgent,
    message: 'Agent updated successfully',
  });
}));

/**
 * DELETE /api/agents/:id
 * Delete an agent
 */
router.delete('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const agentService = req.app.locals.agentService as AgentService;
  const agentId = req.params.id;
  
  // Check if agent exists and user owns it
  const existingAgent = await agentService.getAgentById(agentId);
  if (!existingAgent) {
    return res.status(404).json({
      success: false,
      error: { message: 'Agent not found' },
    });
  }

  if (existingAgent.user_id !== (req as AuthenticatedRequest).user.id) {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied' },
    });
  }
  
  await agentService.deleteAgent(agentId);
  
  logger.info('Agent deleted via API', { agentId, userId: (req as AuthenticatedRequest).user.id });
  
  res.json({
    success: true,
    message: 'Agent deleted successfully',
  });
}));

/**
 * POST /api/agents/:id/start
 * Start agent monitoring
 */
router.post('/:id/start', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const agentService = req.app.locals.agentService as AgentService;
  const monitoringService = req.app.locals.monitoringService as MonitoringService;
  const agentId = req.params.id;
  
  // Check if agent exists and user owns it
  const existingAgent = await agentService.getAgentById(agentId);
  if (!existingAgent) {
    return res.status(404).json({
      success: false,
      error: { message: 'Agent not found' },
    });
  }

  if (existingAgent.user_id !== (req as AuthenticatedRequest).user.id) {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied' },
    });
  }
  
  await agentService.startAgent(agentId);
  await monitoringService.startAgentMonitoring(agentId);
  
  logger.info('Agent started via API', { agentId, userId: (req as AuthenticatedRequest).user.id });
  
  res.json({
    success: true,
    message: 'Agent monitoring started',
  });
}));

/**
 * POST /api/agents/:id/stop
 * Stop agent monitoring
 */
router.post('/:id/stop', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const agentService = req.app.locals.agentService as AgentService;
  const monitoringService = req.app.locals.monitoringService as MonitoringService;
  const agentId = req.params.id;
  
  // Check if agent exists and user owns it
  const existingAgent = await agentService.getAgentById(agentId);
  if (!existingAgent) {
    return res.status(404).json({
      success: false,
      error: { message: 'Agent not found' },
    });
  }

  if (existingAgent.user_id !== (req as AuthenticatedRequest).user.id) {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied' },
    });
  }
  
  await agentService.stopAgent(agentId);
  await monitoringService.stopAgentMonitoring(agentId);
  
  logger.info('Agent stopped via API', { agentId, userId: (req as AuthenticatedRequest).user.id });
  
  res.json({
    success: true,
    message: 'Agent monitoring stopped',
  });
}));

/**
 * POST /api/agents/:id/execute
 * Execute a specific task with the agent
 */
router.post('/:id/execute', asyncHandler(async (req: Request, res: Response) => {
  const agentService = req.app.locals.agentService as AgentService;
  const agentId = req.params.id;
  const { taskType, description, parameters } = req.body;
  
  // Check if agent exists and user owns it
  const existingAgent = await agentService.getAgentById(agentId);
  if (!existingAgent) {
    return res.status(404).json({
      success: false,
      error: { message: 'Agent not found' },
    });
  }

  if (existingAgent.user_id !== (req as AuthenticatedRequest).user.id) {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied' },
    });
  }

  if (!taskType || !description) {
    return res.status(400).json({
      success: false,
      error: { message: 'taskType and description are required' },
    });
  }
  
  const task = await agentService.executeAgentTask(agentId, taskType, description, parameters || {});
  
  logger.info('Agent task executed via API', { agentId, taskType, userId: (req as AuthenticatedRequest).user.id });
  
  res.json({
    success: true,
    data: task,
    message: 'Task executed successfully',
  });
}));

/**
 * GET /api/agents/:id/metrics
 * Get agent metrics history
 */
router.get('/:id/metrics', asyncHandler(async (req: Request, res: Response) => {
  const agentService = req.app.locals.agentService as AgentService;
  const agentId = req.params.id;
  const hours = parseInt(req.query.hours as string) || 24;
  
  // Check if agent exists and user owns it
  const existingAgent = await agentService.getAgentById(agentId);
  if (!existingAgent) {
    return res.status(404).json({
      success: false,
      error: { message: 'Agent not found' },
    });
  }

  if (existingAgent.user_id !== (req as AuthenticatedRequest).user.id) {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied' },
    });
  }
  
  const metrics = await agentService.getAgentMetrics(agentId, hours);
  
  res.json({
    success: true,
    data: metrics,
  });
}));

/**
 * GET /api/agents/:id/alerts
 * Get agent alerts
 */
router.get('/:id/alerts', asyncHandler(async (req: Request, res: Response) => {
  const agentService = req.app.locals.agentService as AgentService;
  const agentId = req.params.id;
  const resolved = req.query.resolved === 'true';
  
  // Check if agent exists and user owns it
  const existingAgent = await agentService.getAgentById(agentId);
  if (!existingAgent) {
    return res.status(404).json({
      success: false,
      error: { message: 'Agent not found' },
    });
  }

  if (existingAgent.user_id !== (req as AuthenticatedRequest).user.id) {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied' },
    });
  }
  
  const alerts = await agentService.getAgentAlerts(agentId, resolved);
  
  res.json({
    success: true,
    data: alerts,
  });
}));

/**
 * PUT /api/agents/:id/alerts/:alertId/resolve
 * Resolve an alert
 */
router.put('/:id/alerts/:alertId/resolve', asyncHandler(async (req: Request, res: Response) => {
  const agentService = req.app.locals.agentService as AgentService;
  const agentId = req.params.id;
  const alertId = req.params.alertId;
  
  // Check if agent exists and user owns it
  const existingAgent = await agentService.getAgentById(agentId);
  if (!existingAgent) {
    return res.status(404).json({
      success: false,
      error: { message: 'Agent not found' },
    });
  }

  if (existingAgent.user_id !== (req as AuthenticatedRequest).user.id) {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied' },
    });
  }
  
  await agentService.resolveAlert(alertId, (req as AuthenticatedRequest).user.id);
  
  logger.info('Alert resolved via API', { agentId, alertId, userId: (req as AuthenticatedRequest).user.id });
  
  res.json({
    success: true,
    message: 'Alert resolved successfully',
  });
}));

export default router;
