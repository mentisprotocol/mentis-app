import { SupportedChain, NodeType, AgentStatus } from '../types';

export interface Agent {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  chain: SupportedChain;
  node_type: NodeType;
  status: AgentStatus;
  endpoint_url: string;
  config: Record<string, any>;
  last_health_check?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAgentData {
  user_id: string;
  name: string;
  description?: string;
  chain: SupportedChain;
  node_type: NodeType;
  endpoint_url: string;
  config?: Record<string, any>;
}

export interface UpdateAgentData {
  name?: string;
  description?: string;
  endpoint_url?: string;
  config?: Record<string, any>;
  status?: AgentStatus;
  last_health_check?: Date;
}

export interface AgentWithMetrics extends Agent {
  current_uptime?: number;
  current_response_time?: number;
  current_sync_status?: boolean;
  active_alerts?: number;
}

export interface AgentMetrics {
  id: string;
  agent_id: string;
  uptime: number;
  response_time: number;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_latency: number;
  peer_count: number;
  block_height: number;
  sync_status: boolean;
  recorded_at: Date;
}

export interface CreateAgentMetricsData {
  agent_id: string;
  uptime: number;
  response_time: number;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_latency: number;
  peer_count: number;
  block_height: number;
  sync_status: boolean;
}

