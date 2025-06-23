// Supported blockchain networks
export enum SupportedChain {
  ETHEREUM = 'ethereum',
  SOLANA = 'solana',
  COSMOS = 'cosmos',
  POLYGON = 'polygon',
  AVALANCHE = 'avalanche',
  BSC = 'bsc',
}

// Node types
export enum NodeType {
  VALIDATOR = 'validator',
  RPC = 'rpc',
  FULL_NODE = 'full_node',
  LIGHT_CLIENT = 'light_client',
  ARCHIVE = 'archive',
}

// Agent status
export enum AgentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  MAINTENANCE = 'maintenance',
}

// Alert severity levels
export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Subscription plans
export enum SubscriptionPlan {
  STARTER = 'starter',
  CORE = 'core',
  ENTERPRISE = 'enterprise',
}

// Subscription status
export enum SubscriptionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  TRIALING = 'trialing',
}

// Task types for AI agents
export enum TaskType {
  MONITOR = 'monitor',
  ANALYZE = 'analyze',
  REPAIR = 'repair',
  OPTIMIZE = 'optimize',
  ALERT = 'alert',
}

// Task status
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// Task priority
export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  message?: string;
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Agent configuration
export interface AgentConfig {
  llmProvider?: 'openai' | 'anthropic';
  model?: string;
  systemPrompt?: string;
  tools?: string[];
  maxIterations?: number;
  temperature?: number;
  monitoringInterval?: number;
  alertThresholds?: {
    uptime?: number;
    responseTime?: number;
    errorRate?: number;
    memoryUsage?: number;
    cpuUsage?: number;
    diskUsage?: number;
  };
}

// Blockchain network configuration
export interface ChainConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl?: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockTime: number; // in seconds
  finalityBlocks: number;
}

// Node metrics
export interface NodeMetrics {
  uptime: number;
  responseTime: number;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkLatency: number;
  peerCount: number;
  blockHeight: number;
  syncStatus: boolean;
  timestamp: Date;
}

// Alert configuration
export interface AlertConfig {
  enabled: boolean;
  channels: ('email' | 'slack' | 'telegram' | 'webhook')[];
  thresholds: {
    uptime: number;
    responseTime: number;
    errorRate: number;
  };
  cooldown: number; // minutes
}

// WebSocket events
export interface WebSocketEvents {
  // Client to server
  'join-agent-room': (agentId: string) => void;
  'join-user-room': (userId: string) => void;
  'request-metrics': (data: { agentId: string; timeRange: string }) => void;
  'request-system-health': () => void;

  // Server to client
  'health_check': (data: { agentId: string; status: string; result: any; timestamp: Date }) => void;
  'metrics': (data: { agentId: string; metrics: NodeMetrics; timestamp: Date }) => void;
  'metrics-history': (data: { agentId: string; metrics: NodeMetrics[] }) => void;
  'alert': (alert: any) => void;
  'system-health': (health: any) => void;
  'error': (error: { message: string }) => void;
}

// Database table interfaces
export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name?: string;
  last_name?: string;
  is_verified: boolean;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Agent {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  chain: SupportedChain;
  node_type: NodeType;
  endpoint_url: string;
  config: AgentConfig;
  status: AgentStatus;
  last_health_check?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  current_period_start: Date;
  current_period_end: Date;
  cancel_at_period_end: boolean;
  stripe_subscription_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Alert {
  id: string;
  agent_id: string;
  user_id: string;
  type: string;
  severity: AlertSeverity;
  message: string;
  resolved: boolean;
  resolved_at?: Date;
  resolved_by?: string;
  created_at: Date;
}

// Error types
export class MentisError extends Error {
  public code: string;
  public statusCode: number;
  public details?: any;

  constructor(message: string, code: string = 'INTERNAL_ERROR', statusCode: number = 500, details?: any) {
    super(message);
    this.name = 'MentisError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends MentisError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends MentisError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends MentisError {
  constructor(message: string = 'Access denied') {
    super(message, 'AUTHORIZATION_ERROR', 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends MentisError {
  constructor(message: string = 'Resource not found') {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends MentisError {
  constructor(message: string = 'Resource conflict') {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends MentisError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
    this.name = 'RateLimitError';
  }
}

// All types are already exported above
