-- Mentis Protocol Database Schema
-- Initial migration for PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE subscription_plan AS ENUM ('starter', 'core', 'enterprise');
CREATE TYPE subscription_status AS ENUM ('active', 'inactive', 'cancelled', 'past_due');
CREATE TYPE agent_status AS ENUM ('active', 'inactive', 'error', 'maintenance');
CREATE TYPE node_type AS ENUM ('validator', 'rpc', 'full_node');
CREATE TYPE supported_chain AS ENUM ('ethereum', 'solana', 'cosmos');
CREATE TYPE alert_severity AS ENUM ('low', 'medium', 'high', 'critical');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscriptions table
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan subscription_plan NOT NULL DEFAULT 'starter',
    status subscription_status NOT NULL DEFAULT 'active',
    current_period_start TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    current_period_end TIMESTAMP NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agents table
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    chain supported_chain NOT NULL,
    node_type node_type NOT NULL,
    status agent_status NOT NULL DEFAULT 'inactive',
    endpoint_url VARCHAR(500) NOT NULL,
    config JSONB DEFAULT '{}',
    last_health_check TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent metrics table (time-series data)
CREATE TABLE agent_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    uptime DECIMAL(5,2) DEFAULT 0,
    response_time INTEGER DEFAULT 0, -- in milliseconds
    cpu_usage DECIMAL(5,2) DEFAULT 0,
    memory_usage DECIMAL(5,2) DEFAULT 0,
    disk_usage DECIMAL(5,2) DEFAULT 0,
    network_latency INTEGER DEFAULT 0, -- in milliseconds
    peer_count INTEGER DEFAULT 0,
    block_height BIGINT DEFAULT 0,
    sync_status BOOLEAN DEFAULT FALSE,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alerts table
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    severity alert_severity NOT NULL,
    message TEXT NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table (for revenue tracking)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    chain supported_chain,
    transaction_hash VARCHAR(255),
    block_number BIGINT,
    from_address VARCHAR(255),
    to_address VARCHAR(255),
    value DECIMAL(36,18), -- Support for large numbers with 18 decimal places
    gas_used BIGINT,
    gas_price DECIMAL(36,18),
    status VARCHAR(50),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification settings table
CREATE TABLE notification_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_enabled BOOLEAN DEFAULT TRUE,
    slack_webhook_url VARCHAR(500),
    telegram_chat_id VARCHAR(100),
    webhook_url VARCHAR(500),
    alert_thresholds JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API keys table
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    permissions JSONB DEFAULT '[]',
    last_used TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_agents_user_id ON agents(user_id);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_chain ON agents(chain);
CREATE INDEX idx_agent_metrics_agent_id ON agent_metrics(agent_id);
CREATE INDEX idx_agent_metrics_recorded_at ON agent_metrics(recorded_at);
CREATE INDEX idx_agent_metrics_agent_recorded ON agent_metrics(agent_id, recorded_at);
CREATE INDEX idx_alerts_agent_id ON alerts(agent_id);
CREATE INDEX idx_alerts_user_id ON alerts(user_id);
CREATE INDEX idx_alerts_resolved ON alerts(resolved);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_agent_id ON transactions(agent_id);
CREATE INDEX idx_transactions_chain ON transactions(chain);
CREATE INDEX idx_transactions_recorded_at ON transactions(recorded_at);
CREATE INDEX idx_notification_settings_user_id ON notification_settings(user_id);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_settings_updated_at BEFORE UPDATE ON notification_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default subscription plans data
INSERT INTO users (id, email, password_hash, first_name, last_name, is_verified) VALUES
('00000000-0000-0000-0000-000000000001', 'info@mentisprotocol.ai', '$2b$12$dummy.hash.for.system.user', 'System', 'User', true);

-- Create a view for agent statistics
CREATE VIEW agent_stats AS
SELECT 
    a.id,
    a.name,
    a.chain,
    a.node_type,
    a.status,
    COALESCE(latest_metrics.uptime, 0) as current_uptime,
    COALESCE(latest_metrics.response_time, 0) as current_response_time,
    COALESCE(latest_metrics.sync_status, false) as current_sync_status,
    COUNT(alerts.id) FILTER (WHERE alerts.resolved = false) as active_alerts,
    a.created_at,
    a.updated_at
FROM agents a
LEFT JOIN LATERAL (
    SELECT uptime, response_time, sync_status
    FROM agent_metrics am
    WHERE am.agent_id = a.id
    ORDER BY am.recorded_at DESC
    LIMIT 1
) latest_metrics ON true
LEFT JOIN alerts ON alerts.agent_id = a.id AND alerts.resolved = false
GROUP BY a.id, a.name, a.chain, a.node_type, a.status, latest_metrics.uptime, 
         latest_metrics.response_time, latest_metrics.sync_status, a.created_at, a.updated_at;

