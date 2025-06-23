import { database } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { Agent, CreateAgentData, UpdateAgentData, AgentWithMetrics } from '../models/Agent';
import { SupportedChain, NodeType, AgentStatus } from '../types';
import { AIAgentService, AIAgentConfig } from './AIAgentService';

export class AgentService {
  private aiAgentService: AIAgentService;

  constructor() {
    this.aiAgentService = new AIAgentService();
  }

  /**
   * Create a new agent with AI capabilities
   */
  async createAgent(data: CreateAgentData): Promise<Agent> {
    try {
      logger.info('Creating new agent', { name: data.name, chain: data.chain });

      // Insert agent into database
      const result = await database.query(
        `INSERT INTO agents (user_id, name, description, chain, node_type, endpoint_url, config, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          data.user_id,
          data.name,
          data.description || null,
          data.chain,
          data.node_type,
          data.endpoint_url,
          JSON.stringify(data.config || {}),
          'inactive'
        ]
      );

      const agent: Agent = result.rows[0];

      // Create AI agent configuration
      const aiConfig: AIAgentConfig = {
        agentId: agent.id,
        userId: agent.user_id,
        name: agent.name,
        chain: agent.chain,
        nodeType: agent.node_type,
        endpointUrl: agent.endpoint_url,
        llmProvider: data.config?.llmProvider || 'openai',
        model: data.config?.model || 'gpt-4o-mini',
        systemPrompt: data.config?.systemPrompt,
        tools: data.config?.tools || ['health_check', 'collect_metrics', 'create_alert'],
        maxIterations: data.config?.maxIterations || 10,
        temperature: data.config?.temperature || 0.1,
      };

      // Initialize AI agent
      await this.aiAgentService.createAgent(aiConfig);

      logger.info('Agent created successfully', { agentId: agent.id });
      return agent;
    } catch (error) {
      logger.error('Failed to create agent', { error });
      throw error;
    }
  }

  /**
   * Get agent by ID with latest metrics
   */
  async getAgentById(agentId: string): Promise<AgentWithMetrics | null> {
    try {
      const result = await database.query(
        `SELECT a.*, 
                COALESCE(latest_metrics.uptime, 0) as current_uptime,
                COALESCE(latest_metrics.response_time, 0) as current_response_time,
                COALESCE(latest_metrics.sync_status, false) as current_sync_status,
                COUNT(alerts.id) FILTER (WHERE alerts.resolved = false) as active_alerts
         FROM agents a
         LEFT JOIN LATERAL (
           SELECT uptime, response_time, sync_status
           FROM agent_metrics am
           WHERE am.agent_id = a.id
           ORDER BY am.recorded_at DESC
           LIMIT 1
         ) latest_metrics ON true
         LEFT JOIN alerts ON alerts.agent_id = a.id AND alerts.resolved = false
         WHERE a.id = $1
         GROUP BY a.id, latest_metrics.uptime, latest_metrics.response_time, latest_metrics.sync_status`,
        [agentId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const agent = result.rows[0];
      return {
        ...agent,
        config: typeof agent.config === 'string' ? JSON.parse(agent.config) : agent.config,
      };
    } catch (error) {
      logger.error('Failed to get agent', { agentId, error });
      throw error;
    }
  }

  /**
   * Get all agents for a user
   */
  async getAgentsByUserId(userId: string): Promise<AgentWithMetrics[]> {
    try {
      const result = await database.query(
        `SELECT * FROM agent_stats WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );

      return result.rows.map((agent: any) => ({
        ...agent,
        config: typeof agent.config === 'string' ? JSON.parse(agent.config) : agent.config,
      }));
    } catch (error) {
      logger.error('Failed to get user agents', { userId, error });
      throw error;
    }
  }

  /**
   * Update agent configuration
   */
  async updateAgent(agentId: string, data: UpdateAgentData): Promise<Agent> {
    try {
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (data.name !== undefined) {
        updateFields.push(`name = $${paramCount++}`);
        values.push(data.name);
      }

      if (data.description !== undefined) {
        updateFields.push(`description = $${paramCount++}`);
        values.push(data.description);
      }

      if (data.endpoint_url !== undefined) {
        updateFields.push(`endpoint_url = $${paramCount++}`);
        values.push(data.endpoint_url);
      }

      if (data.config !== undefined) {
        updateFields.push(`config = $${paramCount++}`);
        values.push(JSON.stringify(data.config));
      }

      if (data.status !== undefined) {
        updateFields.push(`status = $${paramCount++}`);
        values.push(data.status);
      }

      if (data.last_health_check !== undefined) {
        updateFields.push(`last_health_check = $${paramCount++}`);
        values.push(data.last_health_check);
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(agentId);

      const result = await database.query(
        `UPDATE agents SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Agent not found');
      }

      const agent = result.rows[0];
      logger.info('Agent updated successfully', { agentId });

      return {
        ...agent,
        config: typeof agent.config === 'string' ? JSON.parse(agent.config) : agent.config,
      };
    } catch (error) {
      logger.error('Failed to update agent', { agentId, error });
      throw error;
    }
  }

  /**
   * Delete an agent
   */
  async deleteAgent(agentId: string): Promise<void> {
    try {
      // Stop monitoring first
      await this.stopAgent(agentId);

      // Delete from database (cascade will handle related records)
      const result = await database.query('DELETE FROM agents WHERE id = $1', [agentId]);

      if (result.rowCount === 0) {
        throw new Error('Agent not found');
      }

      logger.info('Agent deleted successfully', { agentId });
    } catch (error) {
      logger.error('Failed to delete agent', { agentId, error });
      throw error;
    }
  }

  /**
   * Start agent monitoring
   */
  async startAgent(agentId: string): Promise<void> {
    try {
      logger.info('Starting agent', { agentId });

      // Update agent status
      await this.updateAgent(agentId, { status: AgentStatus.ACTIVE });

      // Start AI agent monitoring
      await this.aiAgentService.startMonitoring(agentId);

      // Cache agent status
      await redis.set(`agent:${agentId}:status`, 'active', 3600);

      logger.info('Agent started successfully', { agentId });
    } catch (error) {
      logger.error('Failed to start agent', { agentId, error });
      throw error;
    }
  }

  /**
   * Stop agent monitoring
   */
  async stopAgent(agentId: string): Promise<void> {
    try {
      logger.info('Stopping agent', { agentId });

      // Update agent status
      await this.updateAgent(agentId, { status: AgentStatus.INACTIVE });

      // Stop AI agent monitoring
      await this.aiAgentService.stopMonitoring(agentId);

      // Update cache
      await redis.set(`agent:${agentId}:status`, 'inactive', 3600);

      logger.info('Agent stopped successfully', { agentId });
    } catch (error) {
      logger.error('Failed to stop agent', { agentId, error });
      throw error;
    }
  }

  /**
   * Execute a specific task with an agent
   */
  async executeAgentTask(agentId: string, taskType: string, description: string, parameters: Record<string, any> = {}) {
    try {
      logger.info('Executing agent task', { agentId, taskType });

      const task = await this.aiAgentService.executeTask(agentId, {
        agentId,
        type: taskType as any,
        description,
        parameters,
        priority: 'medium',
      });

      return task;
    } catch (error) {
      logger.error('Failed to execute agent task', { agentId, taskType, error });
      throw error;
    }
  }

  /**
   * Get agent status including AI agent information
   */
  async getAgentStatus(agentId: string) {
    try {
      // Get basic agent info
      const agent = await this.getAgentById(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      // Get AI agent status
      const aiStatus = await this.aiAgentService.getAgentStatus(agentId);

      return {
        ...agent,
        aiStatus,
      };
    } catch (error) {
      logger.error('Failed to get agent status', { agentId, error });
      throw error;
    }
  }

  /**
   * Get agent metrics history
   */
  async getAgentMetrics(agentId: string, hours: number = 24): Promise<any[]> {
    try {
      const result = await database.query(
        `SELECT * FROM agent_metrics 
         WHERE agent_id = $1 AND recorded_at >= NOW() - INTERVAL '${hours} hours'
         ORDER BY recorded_at DESC`,
        [agentId]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get agent metrics', { agentId, error });
      throw error;
    }
  }

  /**
   * Get agent alerts
   */
  async getAgentAlerts(agentId: string, resolved: boolean = false): Promise<any[]> {
    try {
      const result = await database.query(
        `SELECT * FROM alerts 
         WHERE agent_id = $1 AND resolved = $2
         ORDER BY created_at DESC`,
        [agentId, resolved]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get agent alerts', { agentId, error });
      throw error;
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, userId: string): Promise<void> {
    try {
      await database.query(
        `UPDATE alerts 
         SET resolved = true, resolved_at = CURRENT_TIMESTAMP, resolved_by = $1
         WHERE id = $2`,
        [userId, alertId]
      );

      logger.info('Alert resolved', { alertId, userId });
    } catch (error) {
      logger.error('Failed to resolve alert', { alertId, error });
      throw error;
    }
  }

  /**
   * Get dashboard statistics for user agents
   */
  async getDashboardStats(userId: string): Promise<any> {
    try {
      const result = await database.query(
        `SELECT 
           COUNT(*) as total_agents,
           COUNT(*) FILTER (WHERE status = 'active') as active_agents,
           COUNT(*) FILTER (WHERE status = 'error') as error_agents,
           AVG(CASE WHEN latest_metrics.uptime IS NOT NULL THEN latest_metrics.uptime ELSE 0 END) as avg_uptime
         FROM agents a
         LEFT JOIN LATERAL (
           SELECT uptime
           FROM agent_metrics am
           WHERE am.agent_id = a.id
           ORDER BY am.recorded_at DESC
           LIMIT 1
         ) latest_metrics ON true
         WHERE a.user_id = $1`,
        [userId]
      );

      const alertsResult = await database.query(
        `SELECT COUNT(*) as unresolved_alerts
         FROM alerts a
         JOIN agents ag ON a.agent_id = ag.id
         WHERE ag.user_id = $1 AND a.resolved = false`,
        [userId]
      );

      return {
        ...result.rows[0],
        unresolved_alerts: parseInt(alertsResult.rows[0].unresolved_alerts),
      };
    } catch (error) {
      logger.error('Failed to get dashboard stats', { userId, error });
      throw error;
    }
  }
}
