import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { DynamicTool } from '@langchain/core/tools';
import { MemorySaver } from '@langchain/langgraph';
import { logger } from '../utils/logger';
import { database } from '../config/database';
import { redis } from '../config/redis';
import { Agent, AgentMetrics } from '../models/Agent';
import { SupportedChain, NodeType, AgentStatus } from '../types';

export interface AIAgentConfig {
  agentId: string;
  userId: string;
  name: string;
  chain: SupportedChain;
  nodeType: NodeType;
  endpointUrl: string;
  llmProvider: 'openai' | 'anthropic';
  model: string;
  systemPrompt?: string;
  tools: string[];
  maxIterations: number;
  temperature: number;
}

export interface AgentTask {
  id: string;
  agentId: string;
  type: 'monitor' | 'analyze' | 'repair' | 'optimize' | 'alert';
  description: string;
  parameters: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export class AIAgentService {
  private agents: Map<string, any> = new Map();
  private checkpointer: MemorySaver;

  constructor() {
    this.checkpointer = new MemorySaver();
  }

  /**
   * Create and initialize an AI agent
   */
  async createAgent(config: AIAgentConfig): Promise<string> {
    try {
      logger.info('Creating AI agent', { agentId: config.agentId, name: config.name });

      // Initialize LLM based on provider
      const llm = this.initializeLLM(config.llmProvider, config.model, config.temperature);

      // Create tools for the agent
      const tools = await this.createAgentTools(config);

      // Bind tools to the LLM
      const modelWithTools = llm.bindTools(tools);

      // Create the agent workflow
      const workflow = this.createAgentWorkflow(modelWithTools, tools, config);

      // Compile the agent
      const agent = workflow.compile({
        checkpointer: this.checkpointer,
      });

      // Store the agent
      this.agents.set(config.agentId, {
        agent,
        config,
        status: 'active',
        lastActivity: new Date(),
      });

      // Update agent status in database
      await this.updateAgentStatus(config.agentId, AgentStatus.ACTIVE);

      logger.info('AI agent created successfully', { agentId: config.agentId });
      return config.agentId;
    } catch (error) {
      logger.error('Failed to create AI agent', { agentId: config.agentId, error });
      throw error;
    }
  }

  /**
   * Execute a task with an AI agent
   */
  async executeTask(agentId: string, task: Omit<AgentTask, 'id' | 'createdAt' | 'status'>): Promise<AgentTask> {
    const agentData = this.agents.get(agentId);
    if (!agentData) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullTask: AgentTask = {
      id: taskId,
      ...task,
      status: 'pending',
      createdAt: new Date(),
    };

    try {
      logger.info('Executing agent task', { agentId, taskId, type: task.type });

      // Update task status
      fullTask.status = 'running';
      await this.storeTask(fullTask);

      // Create system prompt based on task type
      const systemPrompt = this.createSystemPrompt(agentData.config, task);

      // Create task-specific message
      const taskMessage = this.createTaskMessage(task);

      // Execute the agent
      const result = await agentData.agent.invoke(
        {
          messages: [
            new SystemMessage(systemPrompt),
            new HumanMessage(taskMessage),
          ],
        },
        {
          configurable: { thread_id: `${agentId}_${taskId}` },
        }
      );

      // Extract the final response
      const finalMessage = result.messages[result.messages.length - 1];
      const response = finalMessage.content;

      // Update task with result
      fullTask.status = 'completed';
      fullTask.result = response;
      fullTask.completedAt = new Date();

      await this.storeTask(fullTask);

      // Update agent last activity
      agentData.lastActivity = new Date();

      logger.info('Agent task completed successfully', { agentId, taskId });
      return fullTask;
    } catch (error) {
      logger.error('Agent task failed', { agentId, taskId, error });

      fullTask.status = 'failed';
      fullTask.error = error instanceof Error ? error.message : 'Unknown error';
      fullTask.completedAt = new Date();

      await this.storeTask(fullTask);
      throw error;
    }
  }

  /**
   * Start continuous monitoring for an agent
   */
  async startMonitoring(agentId: string): Promise<void> {
    const agentData = this.agents.get(agentId);
    if (!agentData) {
      throw new Error(`Agent ${agentId} not found`);
    }

    logger.info('Starting continuous monitoring', { agentId });

    // Create monitoring interval
    const monitoringInterval = setInterval(async () => {
      try {
        await this.performMonitoringCycle(agentId);
      } catch (error) {
        logger.error('Monitoring cycle failed', { agentId, error });
      }
    }, 30000); // Monitor every 30 seconds

    agentData.monitoringInterval = monitoringInterval;
  }

  /**
   * Stop monitoring for an agent
   */
  async stopMonitoring(agentId: string): Promise<void> {
    const agentData = this.agents.get(agentId);
    if (!agentData?.monitoringInterval) {
      return;
    }

    logger.info('Stopping monitoring', { agentId });
    clearInterval(agentData.monitoringInterval);
    delete agentData.monitoringInterval;
  }

  /**
   * Get agent status and metrics
   */
  async getAgentStatus(agentId: string): Promise<any> {
    const agentData = this.agents.get(agentId);
    if (!agentData) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Get recent tasks
    const recentTasks = await this.getRecentTasks(agentId, 10);

    // Get latest metrics
    const latestMetrics = await this.getLatestMetrics(agentId);

    return {
      agentId,
      status: agentData.status,
      lastActivity: agentData.lastActivity,
      isMonitoring: !!agentData.monitoringInterval,
      recentTasks,
      latestMetrics,
      config: agentData.config,
    };
  }

  /**
   * Initialize LLM based on provider
   */
  private initializeLLM(provider: string, model: string, temperature: number) {
    switch (provider) {
      case 'openai':
        return new ChatOpenAI({
          model: model || 'gpt-4o-mini',
          temperature,
          openAIApiKey: process.env.OPENAI_API_KEY,
        });
      case 'anthropic':
        return new ChatAnthropic({
          model: model || 'claude-3-sonnet-20240229',
          temperature,
          anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        });
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  }

  /**
   * Create tools for the agent based on configuration
   */
  private async createAgentTools(config: AIAgentConfig): Promise<DynamicTool[]> {
    const tools: DynamicTool[] = [];

    // Node Health Check Tool
    if (config.tools.includes('health_check')) {
      tools.push(
        new DynamicTool({
          name: 'check_node_health',
          description: 'Check the health status of the blockchain node',
          func: async () => {
            return await this.checkNodeHealth(config.endpointUrl, config.chain);
          },
        })
      );
    }

    // Metrics Collection Tool
    if (config.tools.includes('collect_metrics')) {
      tools.push(
        new DynamicTool({
          name: 'collect_metrics',
          description: 'Collect performance metrics from the node',
          func: async () => {
            return await this.collectNodeMetrics(config.agentId, config.endpointUrl, config.chain);
          },
        })
      );
    }

    // Alert Creation Tool
    if (config.tools.includes('create_alert')) {
      tools.push(
        new DynamicTool({
          name: 'create_alert',
          description: 'Create an alert for detected issues',
          func: async (input: string) => {
            const alertData = JSON.parse(input);
            return await this.createAlert(config.agentId, config.userId, alertData);
          },
        })
      );
    }

    // Node Restart Tool
    if (config.tools.includes('restart_node')) {
      tools.push(
        new DynamicTool({
          name: 'restart_node',
          description: 'Restart the blockchain node (use with caution)',
          func: async () => {
            return await this.restartNode(config.endpointUrl, config.chain);
          },
        })
      );
    }

    // Database Query Tool
    if (config.tools.includes('query_database')) {
      tools.push(
        new DynamicTool({
          name: 'query_database',
          description: 'Query historical metrics and data from the database',
          func: async (query: string) => {
            return await this.queryHistoricalData(config.agentId, query);
          },
        })
      );
    }

    return tools;
  }

  /**
   * Create the agent workflow using StateGraph
   */
  private createAgentWorkflow(modelWithTools: any, tools: DynamicTool[], config: AIAgentConfig) {
    const toolNode = new ToolNode(tools);

    // Define the function that determines whether to continue or not
    function shouldContinue({ messages }: typeof MessagesAnnotation.State) {
      const lastMessage = messages[messages.length - 1] as AIMessage;

      // If the LLM makes a tool call, then we route to the "tools" node
      if (lastMessage.tool_calls?.length) {
        return 'tools';
      }
      // Otherwise, we stop (reply to the user)
      return '__end__';
    }

    // Define the function that calls the model
    async function callModel(state: typeof MessagesAnnotation.State) {
      const response = await modelWithTools.invoke(state.messages);
      return { messages: [response] };
    }

    // Define the workflow
    const workflow = new StateGraph(MessagesAnnotation)
      .addNode('agent', callModel)
      .addEdge('__start__', 'agent')
      .addNode('tools', toolNode)
      .addEdge('tools', 'agent')
      .addConditionalEdges('agent', shouldContinue);

    return workflow;
  }

  /**
   * Create system prompt based on agent configuration and task
   */
  private createSystemPrompt(config: AIAgentConfig, task: any): string {
    const basePrompt = `You are an AI agent for the Mentis Protocol, responsible for autonomous blockchain infrastructure management.

Agent Details:
- Name: ${config.name}
- Chain: ${config.chain}
- Node Type: ${config.nodeType}
- Endpoint: ${config.endpointUrl}

Your primary responsibilities:
1. Monitor blockchain node health and performance
2. Detect and alert on potential issues
3. Perform automated maintenance and optimization
4. Ensure maximum uptime and reliability
5. Prevent slashing risks for validators

Current Task: ${task.type}
Task Description: ${task.description}

Guidelines:
- Always prioritize node stability and security
- Use available tools to gather information before making decisions
- Create alerts for any critical issues detected
- Provide clear, actionable recommendations
- Be proactive in preventing problems

Available Tools: ${config.tools.join(', ')}`;

    return config.systemPrompt ? `${config.systemPrompt}\n\n${basePrompt}` : basePrompt;
  }

  /**
   * Create task-specific message
   */
  private createTaskMessage(task: any): string {
    let message = `Please execute the following task:\n\nTask Type: ${task.type}\nDescription: ${task.description}\nPriority: ${task.priority}`;

    if (task.parameters && Object.keys(task.parameters).length > 0) {
      message += `\n\nParameters:\n${JSON.stringify(task.parameters, null, 2)}`;
    }

    message += '\n\nPlease analyze the situation, use appropriate tools, and provide a comprehensive response with any actions taken.';

    return message;
  }

  /**
   * Perform a monitoring cycle
   */
  private async performMonitoringCycle(agentId: string): Promise<void> {
    await this.executeTask(agentId, {
      agentId,
      type: 'monitor',
      description: 'Perform routine monitoring check of node health and performance',
      parameters: {},
      priority: 'medium',
    });
  }

  /**
   * Tool implementations
   */
  private async checkNodeHealth(endpointUrl: string, chain: SupportedChain): Promise<string> {
    try {
      // Implementation depends on the blockchain
      // This is a simplified example
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: chain === 'ethereum' ? 'eth_blockNumber' : 'getHealth',
          params: [],
          id: 1,
        }),
      });

      const data = await response.json() as any;
      return JSON.stringify({
        status: response.ok ? 'healthy' : 'unhealthy',
        latestBlock: data.result,
        responseTime: Date.now(),
      });
    } catch (error) {
      return JSON.stringify({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async collectNodeMetrics(agentId: string, endpointUrl: string, chain: SupportedChain): Promise<string> {
    try {
      // Collect various metrics
      const metrics = {
        timestamp: new Date(),
        uptime: 99.9, // This would be calculated based on actual monitoring
        responseTime: Math.random() * 100 + 50, // Simulated
        cpuUsage: Math.random() * 100,
        memoryUsage: Math.random() * 100,
        diskUsage: Math.random() * 100,
        networkLatency: Math.random() * 50 + 10,
        peerCount: Math.floor(Math.random() * 50) + 10,
        blockHeight: Math.floor(Math.random() * 1000000) + 18000000,
        syncStatus: Math.random() > 0.1, // 90% chance of being synced
      };

      // Store metrics in database
      await database.query(
        `INSERT INTO agent_metrics (agent_id, uptime, response_time, cpu_usage, memory_usage, 
         disk_usage, network_latency, peer_count, block_height, sync_status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          agentId,
          metrics.uptime,
          metrics.responseTime,
          metrics.cpuUsage,
          metrics.memoryUsage,
          metrics.diskUsage,
          metrics.networkLatency,
          metrics.peerCount,
          metrics.blockHeight,
          metrics.syncStatus,
        ]
      );

      return JSON.stringify(metrics);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to collect metrics',
      });
    }
  }

  private async createAlert(agentId: string, userId: string, alertData: any): Promise<string> {
    try {
      const result = await database.query(
        `INSERT INTO alerts (agent_id, user_id, type, severity, message) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [agentId, userId, alertData.type, alertData.severity, alertData.message]
      );

      return JSON.stringify({
        success: true,
        alertId: result.rows[0].id,
        message: 'Alert created successfully',
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create alert',
      });
    }
  }

  private async restartNode(endpointUrl: string, chain: SupportedChain): Promise<string> {
    // This would implement actual node restart logic
    // For now, return a simulated response
    return JSON.stringify({
      success: true,
      message: 'Node restart initiated',
      timestamp: new Date(),
    });
  }

  private async queryHistoricalData(agentId: string, query: string): Promise<string> {
    try {
      // Parse the query and execute appropriate database query
      // This is a simplified implementation
      const result = await database.query(
        `SELECT * FROM agent_metrics WHERE agent_id = $1 ORDER BY recorded_at DESC LIMIT 10`,
        [agentId]
      );

      return JSON.stringify(result.rows);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : 'Query failed',
      });
    }
  }

  /**
   * Helper methods
   */
  private async updateAgentStatus(agentId: string, status: AgentStatus): Promise<void> {
    await database.query(
      'UPDATE agents SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [status, agentId]
    );
  }

  private async storeTask(task: AgentTask): Promise<void> {
    // Store task in Redis for quick access
    await redis.set(`task:${task.id}`, JSON.stringify(task), 3600); // 1 hour TTL
  }

  private async getRecentTasks(agentId: string, limit: number): Promise<AgentTask[]> {
    // This would query tasks from Redis or database
    // Simplified implementation
    return [];
  }

  private async getLatestMetrics(agentId: string): Promise<AgentMetrics | null> {
    try {
      const result = await database.query(
        `SELECT * FROM agent_metrics WHERE agent_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
        [agentId]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get latest metrics', { agentId, error });
      return null;
    }
  }
}
