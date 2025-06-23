import { Server } from 'socket.io';
import cron from 'node-cron';
import { database } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { AgentService } from './AgentService';
import { NotificationService } from './NotificationService';
import { SupportedChain, AgentStatus, AlertSeverity } from '../types';

export { AlertSeverity };

export interface MonitoringAlert {
  id: string;
  agentId: string;
  type: string;
  severity: AlertSeverity;
  message: string;
  timestamp: Date;
  resolved: boolean;
}

export interface SystemHealth {
  totalAgents: number;
  activeAgents: number;
  errorAgents: number;
  avgUptime: number;
  unresolvedAlerts: number;
  systemStatus: 'healthy' | 'warning' | 'critical';
}

export class MonitoringService {
  private io: Server;
  private agentService: AgentService;
  private notificationService: NotificationService;
  private monitoringJobs: Map<string, any> = new Map();
  private isRunning: boolean = false;

  constructor(io: Server) {
    this.io = io;
    this.agentService = new AgentService();
    this.notificationService = new NotificationService();
  }

  /**
   * Start the monitoring service
   */
  async startMonitoring(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Monitoring service is already running');
      return;
    }

    try {
      logger.info('Starting monitoring service');

      // Start system health monitoring
      this.startSystemHealthMonitoring();

      // Start agent discovery and monitoring
      await this.discoverAndMonitorAgents();

      // Start periodic cleanup
      this.startPeriodicCleanup();

      // Start real-time metrics broadcasting
      this.startMetricsBroadcasting();

      this.isRunning = true;
      logger.info('Monitoring service started successfully');
    } catch (error) {
      logger.error('Failed to start monitoring service', { error });
      throw error;
    }
  }

  /**
   * Stop the monitoring service
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping monitoring service');

    // Stop all monitoring jobs
    for (const [jobId, job] of this.monitoringJobs) {
      if (job.destroy) {
        job.destroy();
      }
      this.monitoringJobs.delete(jobId);
    }

    this.isRunning = false;
    logger.info('Monitoring service stopped');
  }

  /**
   * Start monitoring for a specific agent
   */
  async startAgentMonitoring(agentId: string): Promise<void> {
    if (this.monitoringJobs.has(agentId)) {
      logger.warn('Agent monitoring already active', { agentId });
      return;
    }

    try {
      logger.info('Starting agent monitoring', { agentId });

      // Create monitoring job for this agent
      const job = cron.schedule('*/30 * * * * *', async () => {
        await this.performAgentHealthCheck(agentId);
      }, {
        scheduled: false,
        name: `agent-monitor-${agentId}`,
      });

      // Start the job
      job.start();
      this.monitoringJobs.set(agentId, job);

      // Perform initial health check
      await this.performAgentHealthCheck(agentId);

      logger.info('Agent monitoring started', { agentId });
    } catch (error) {
      logger.error('Failed to start agent monitoring', { agentId, error });
      throw error;
    }
  }

  /**
   * Stop monitoring for a specific agent
   */
  async stopAgentMonitoring(agentId: string): Promise<void> {
    const job = this.monitoringJobs.get(agentId);
    if (!job) {
      return;
    }

    logger.info('Stopping agent monitoring', { agentId });
    job.destroy();
    this.monitoringJobs.delete(agentId);
  }

  /**
   * Perform health check for an agent using AI
   */
  private async performAgentHealthCheck(agentId: string): Promise<void> {
    try {
      // Execute AI-powered health check
      const task = await this.agentService.executeAgentTask(
        agentId,
        'monitor',
        'Perform comprehensive health check and collect metrics',
        {
          checkType: 'full',
          includeMetrics: true,
          alertOnIssues: true,
        }
      );

      // Broadcast real-time update
      this.io.to(`agent-${agentId}`).emit('health_check', {
        agentId,
        status: task.status,
        result: task.result,
        timestamp: new Date(),
      });

      // Update agent last health check
      await this.agentService.updateAgent(agentId, {
        last_health_check: new Date(),
      });

    } catch (error) {
      logger.error('Agent health check failed', { agentId, error });

      // Create critical alert for failed health check
      await this.createAlert(agentId, {
        type: 'health_check_failed',
        severity: AlertSeverity.CRITICAL,
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  /**
   * Create and process an alert
   */
  async createAlert(agentId: string, alertData: {
    type: string;
    severity: AlertSeverity;
    message: string;
  }): Promise<string> {
    try {
      // Get agent info
      const agent = await this.agentService.getAgentById(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      // Insert alert into database
      const result = await database.query(
        `INSERT INTO alerts (agent_id, user_id, type, severity, message)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [agentId, agent.user_id, alertData.type, alertData.severity, alertData.message]
      );

      const alertId = result.rows[0].id;

      // Create alert object
      const alert: MonitoringAlert = {
        id: alertId,
        agentId,
        type: alertData.type,
        severity: alertData.severity,
        message: alertData.message,
        timestamp: new Date(),
        resolved: false,
      };

      // Broadcast alert via WebSocket
      this.io.to(`agent-${agentId}`).emit('alert', alert);
      this.io.to(`user-${agent.user_id}`).emit('alert', alert);

      // Send notifications based on severity
      if (alertData.severity === 'high' || alertData.severity === 'critical') {
        await this.notificationService.sendAlert(agent.user_id, alert);
      }

      // Cache alert for quick access
      await redis.set(`alert:${alertId}`, JSON.stringify(alert), 3600);

      logger.info('Alert created', { alertId, agentId, severity: alertData.severity });
      return alertId;
    } catch (error) {
      logger.error('Failed to create alert', { agentId, error });
      throw error;
    }
  }

  /**
   * Get system health overview
   */
  async getSystemHealth(): Promise<SystemHealth> {
    try {
      const result = await database.query(`
        SELECT 
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
      `);

      const alertsResult = await database.query(`
        SELECT COUNT(*) as unresolved_alerts
        FROM alerts
        WHERE resolved = false
      `);

      const stats = result.rows[0];
      const unresolvedAlerts = parseInt(alertsResult.rows[0].unresolved_alerts);

      // Determine system status
      let systemStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
      
      if (stats.error_agents > 0 || unresolvedAlerts > 10) {
        systemStatus = 'critical';
      } else if (stats.avg_uptime < 95 || unresolvedAlerts > 5) {
        systemStatus = 'warning';
      }

      return {
        totalAgents: parseInt(stats.total_agents),
        activeAgents: parseInt(stats.active_agents),
        errorAgents: parseInt(stats.error_agents),
        avgUptime: parseFloat(stats.avg_uptime) || 0,
        unresolvedAlerts,
        systemStatus,
      };
    } catch (error) {
      logger.error('Failed to get system health', { error });
      throw error;
    }
  }

  /**
   * Get real-time metrics for an agent
   */
  async getAgentMetrics(agentId: string, timeRange: string = '1h'): Promise<any[]> {
    try {
      let interval = '1 hour';
      switch (timeRange) {
        case '5m':
          interval = '5 minutes';
          break;
        case '15m':
          interval = '15 minutes';
          break;
        case '1h':
          interval = '1 hour';
          break;
        case '6h':
          interval = '6 hours';
          break;
        case '24h':
          interval = '24 hours';
          break;
        case '7d':
          interval = '7 days';
          break;
      }

      const result = await database.query(
        `SELECT * FROM agent_metrics 
         WHERE agent_id = $1 AND recorded_at >= NOW() - INTERVAL '${interval}'
         ORDER BY recorded_at ASC`,
        [agentId]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get agent metrics', { agentId, error });
      throw error;
    }
  }

  /**
   * Start system health monitoring
   */
  private startSystemHealthMonitoring(): void {
    const job = cron.schedule('*/5 * * * *', async () => {
      try {
        const health = await this.getSystemHealth();
        
        // Broadcast system health
        this.io.emit('system_health', health);

        // Cache system health
        await redis.set('system:health', JSON.stringify(health), 300);

        // Create system alerts if needed
        if (health.systemStatus === 'critical') {
          logger.warn('System health is critical', health);
        }
      } catch (error) {
        logger.error('System health monitoring failed', { error });
      }
    });

    this.monitoringJobs.set('system-health', job);
  }

  /**
   * Discover and start monitoring for all active agents
   */
  private async discoverAndMonitorAgents(): Promise<void> {
    try {
      const result = await database.query(
        `SELECT id FROM agents WHERE status = 'active'`
      );

      for (const row of result.rows) {
        await this.startAgentMonitoring(row.id);
      }

      logger.info(`Started monitoring for ${result.rows.length} active agents`);
    } catch (error) {
      logger.error('Failed to discover agents', { error });
    }
  }

  /**
   * Start periodic cleanup of old data
   */
  private startPeriodicCleanup(): void {
    const job = cron.schedule('0 2 * * *', async () => {
      try {
        // Clean up old metrics (older than 30 days)
        await database.query(
          `DELETE FROM agent_metrics WHERE recorded_at < NOW() - INTERVAL '30 days'`
        );

        // Clean up resolved alerts (older than 7 days)
        await database.query(
          `DELETE FROM alerts WHERE resolved = true AND resolved_at < NOW() - INTERVAL '7 days'`
        );

        logger.info('Periodic cleanup completed');
      } catch (error) {
        logger.error('Periodic cleanup failed', { error });
      }
    });

    this.monitoringJobs.set('cleanup', job);
  }

  /**
   * Start real-time metrics broadcasting
   */
  private startMetricsBroadcasting(): void {
    const job = cron.schedule('*/10 * * * * *', async () => {
      try {
        // Get all active agents
        const result = await database.query(
          `SELECT id FROM agents WHERE status = 'active'`
        );

        for (const row of result.rows) {
          const agentId = row.id;
          
          // Get latest metrics
          const metricsResult = await database.query(
            `SELECT * FROM agent_metrics 
             WHERE agent_id = $1 
             ORDER BY recorded_at DESC 
             LIMIT 1`,
            [agentId]
          );

          if (metricsResult.rows.length > 0) {
            const metrics = metricsResult.rows[0];
            
            // Broadcast to agent-specific room
            this.io.to(`agent-${agentId}`).emit('metrics', {
              agentId,
              metrics,
              timestamp: new Date(),
            });
          }
        }
      } catch (error) {
        logger.error('Metrics broadcasting failed', { error });
      }
    });

    this.monitoringJobs.set('metrics-broadcast', job);
  }

  /**
   * Handle WebSocket connections
   */
  handleConnection(socket: any): void {
    socket.on('join-agent-room', (agentId: string) => {
      socket.join(`agent-${agentId}`);
      logger.debug('Client joined agent room', { socketId: socket.id, agentId });
    });

    socket.on('join-user-room', (userId: string) => {
      socket.join(`user-${userId}`);
      logger.debug('Client joined user room', { socketId: socket.id, userId });
    });

    socket.on('request-metrics', async (data: { agentId: string; timeRange: string }) => {
      try {
        const metrics = await this.getAgentMetrics(data.agentId, data.timeRange);
        socket.emit('metrics-history', { agentId: data.agentId, metrics });
      } catch (error) {
        socket.emit('error', { message: 'Failed to get metrics' });
      }
    });

    socket.on('request-system-health', async () => {
      try {
        const health = await this.getSystemHealth();
        socket.emit('system-health', health);
      } catch (error) {
        socket.emit('error', { message: 'Failed to get system health' });
      }
    });
  }
}
