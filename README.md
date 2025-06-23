# Mentis Protocol Backend

🤖 **Autonomous infrastructure management backend for blockchain nodes, validators, and RPC endpoints.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## ✨ Features

### 🤖 **AI-Powered Autonomous Management**
- **LangChain Integration**: Advanced AI agents with tool-based architecture
- **Multi-LLM Support**: OpenAI GPT-4 and Anthropic Claude
- **Intelligent Decision Making**: AI-driven monitoring, analysis, and remediation
- **Custom Agent Tools**: Blockchain-specific operations and integrations

### 🔗 **Multi-Chain Infrastructure**
- **Ethereum**: Validators, RPC nodes, and full nodes
- **Solana**: Validators and RPC endpoints
- **Cosmos**: Hub and ecosystem chains
- **Extensible**: Easy addition of new blockchain networks

### 📊 **Comprehensive Monitoring**
- **Real-time Metrics**: Performance, uptime, and health monitoring
- **Predictive Analytics**: AI-powered issue detection
- **Custom Dashboards**: Detailed analytics and reporting
- **WebSocket Updates**: Live data streaming

### 🚨 **Advanced Alerting**
- **Multi-Channel Notifications**: Email, Slack, Telegram, webhooks
- **Intelligent Routing**: AI-determined alert severity and routing
- **Alert Management**: Resolution tracking and escalation
- **Custom Thresholds**: Configurable monitoring parameters

### 💰 **Subscription Management**
- **Flexible Plans**: Starter ($9), Core ($19), Enterprise ($99)
- **Usage Tracking**: Real-time monitoring of plan limits
- **Billing Integration**: Automated payment processing
- **Revenue Analytics**: Comprehensive financial reporting

## 🤖 AI Agent System

### **Autonomous Infrastructure Management**
- **24/7 AI Monitoring**: Intelligent agents powered by LangChain v0.3 continuously monitor your infrastructure
- **Multi-LLM Support**: Choose between OpenAI GPT-4 and Anthropic Claude for agent reasoning
- **StateGraph Workflows**: Advanced decision-making with tool-based architecture
- **Real-time Task Execution**: Agents can execute monitoring, analysis, repair, and optimization tasks
- **Custom System Prompts**: Tailor AI behavior for specific blockchain environments

### **Intelligent Capabilities**
- **Health Analysis**: AI-powered node health assessment with contextual insights
- **Predictive Maintenance**: Proactive issue detection before failures occur
- **Auto-remediation**: Agents can automatically restart nodes and fix common issues
- **Performance Optimization**: AI-driven resource scaling and load balancing recommendations
- **Slashing Prevention**: Advanced validator risk detection and mitigation strategies

### **Tool Integration**
- **Blockchain Tools**: Native support for Ethereum, Solana, Cosmos operations
- **Monitoring Tools**: Comprehensive metrics collection and analysis
- **Alert Tools**: Intelligent alert creation with severity assessment
- **Database Tools**: Historical data querying and trend analysis
- **Custom Tools**: Extensible architecture for blockchain-specific operations

## 🏗️ Architecture

```
src/
├── config/          # Database and Redis configuration
├── middleware/      # Authentication, rate limiting, error handling
├── models/          # MongoDB schemas
├── routes/          # API endpoints
├── services/        # Business logic
├── types/           # TypeScript interfaces
└── utils/           # Helper functions
```

## 🛠️ Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL + Redis
- **AI/LLM**: LangChain v0.3, OpenAI GPT-4, Anthropic Claude
- **Real-time**: Socket.IO
- **Blockchain**: Ethers.js, Solana Web3.js, CosmJS
- **Authentication**: JWT
- **Monitoring**: Winston logging
- **Validation**: Joi
- **Testing**: Jest

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL 13+
- Redis 6.0+
- TypeScript

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd mentis-app
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Database Setup

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Or use local installations
# PostgreSQL should be running on port 5432
# Redis should be running on port 6379

# Run database migrations
npm run migrate
```

### 4. Development

```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://mentis_user:mentis_password@localhost:5432/mentis_db` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | JWT signing secret | Required |
| `ETHEREUM_RPC_URL` | Ethereum RPC endpoint | Required |
| `SOLANA_RPC_URL` | Solana RPC endpoint | Required |
| `COSMOS_RPC_URL` | Cosmos RPC endpoint | Required |
| `OPENAI_API_KEY` | OpenAI API key for GPT models | Required |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude models | Optional |
| `LANGCHAIN_API_KEY` | LangSmith API key for tracing | Optional |
| `LANGCHAIN_TRACING_V2` | Enable LangSmith tracing | `true` |

## 📡 API Endpoints

### 🔐 Authentication (`/api/auth`)
- `POST /register` - User registration with email verification
- `POST /login` - User login with JWT token generation
- `GET /profile` - Get authenticated user profile

### 🤖 AI Agents (`/api/agents`)
- `GET /` - List user agents with AI status and metrics
- `POST /` - Create new AI agent with LLM configuration
- `GET /:id` - Get agent details with AI metrics and status
- `PUT /:id` - Update agent configuration and AI settings
- `DELETE /:id` - Delete agent and stop all monitoring
- `POST /:id/start` - Start AI agent monitoring and automation
- `POST /:id/stop` - Stop AI agent monitoring
- `POST /:id/execute` - Execute specific AI agent task
- `GET /:id/metrics` - Get agent metrics history with time filters
- `GET /:id/alerts` - Get agent alerts with filtering options
- `PUT /:id/alerts/:alertId/resolve` - Resolve alert with resolution notes

### 📊 Dashboard (`/api/dashboard`)
- `GET /overview` - Dashboard overview with key statistics
- `GET /performance` - Performance metrics with time range filters
- `GET /alerts` - Alert summary with recent alerts
- `GET /revenue` - Revenue tracking and subscription analytics
- `GET /health` - System health status and service monitoring

### 💳 Subscriptions (`/api/subscriptions`)
- `GET /plans` - Available subscription plans with features
- `GET /` - Current user subscription details
- `PUT /` - Update/change subscription plan
- `DELETE /` - Cancel subscription with options
- `GET /usage` - Current subscription usage and limits
- `GET /billing-history` - Billing history and payment records
- `GET /can-create-agent` - Check if user can create more agents
- `GET /can-use-chain/:chain` - Check chain access permissions

## 🤖 AI Agent Configuration

### Creating an AI Agent

```json
{
  "name": "Ethereum Validator Monitor",
  "description": "AI agent for monitoring Ethereum validator performance",
  "chain": "ethereum",
  "node_type": "validator",
  "endpoint_url": "https://your-ethereum-node.com",
  "config": {
    "llmProvider": "openai",
    "model": "gpt-4o",
    "systemPrompt": "You are an expert Ethereum validator monitoring agent...",
    "tools": ["health_check", "collect_metrics", "create_alert", "restart_node"],
    "maxIterations": 10,
    "temperature": 0.1,
    "alertThresholds": {
      "uptime": 99.5,
      "responseTime": 1000,
      "errorRate": 1.0
    }
  }
}
```

### Available Tools
- `health_check` - Check node health status
- `collect_metrics` - Gather performance metrics
- `create_alert` - Generate alerts for issues
- `restart_node` - Restart node (with safety checks)
- `query_database` - Query historical data

### Supported LLM Models
- **OpenAI**: `gpt-4o`, `gpt-4.1`, `o4-mini`, ...
- **Anthropic**: 'claude-sonnet-4-20250514', `claude-3-sonnet-20240229`, ...

### Task Types
- `monitor` - Routine health and performance monitoring
- `analyze` - Deep analysis of metrics and trends
- `repair` - Automated issue resolution
- `optimize` - Performance optimization recommendations
- `alert` - Alert generation and management

## 🔌 WebSocket Events

### Client → Server
- `join-agent-room` - Join agent-specific room for updates

### Server → Client
- `metrics` - Real-time agent metrics
- `alert` - New alert notification
- `status_change` - Agent status change
- `system_status` - System health update

## 📊 Subscription Plans

### Starter ($9/month)
- 1 agent
- 1 chain support
- Basic uptime monitoring
- Email alerts

### Core ($19/month)
- 3 agents
- All supported chains
- Full automation
- Multiple alert channels
- On-chain reports

### Enterprise ($99/month)
- Unlimited agents
- Custom scripts
- Priority support
- Dedicated API access

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 🐳 Docker Deployment

```bash
# Build image
docker build -t mentis-backend .

# Run with docker-compose
docker-compose up -d
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## �� License

MIT License - see LICENSE file for details

## 📚 Documentation

### 📖 **Comprehensive Documentation Available**
- **[API Documentation](docs/api/README.md)** - Complete API reference with examples
- **[Database Schema](docs/database/schema.md)** - Database design and relationships
- **[System Architecture](docs/architecture/system-overview.md)** - Technical architecture and diagrams
- **[Deployment Guide](docs/deployment/)** - Docker and production deployment
- **[Development Guide](docs/development/)** - Local development setup

### 🏗️ **Architecture Overview**
```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Dashboard]
        API_CLIENT[API Clients]
    end
    
    subgraph "API Layer"
        AUTH[Authentication]
        AGENTS[Agent Management]
        DASHBOARD[Dashboard APIs]
        SUBSCRIPTIONS[Subscription APIs]
    end
    
    subgraph "Service Layer"
        AI_SERVICE[AI Agent Service]
        MONITORING[Monitoring Service]
        NOTIFICATIONS[Notification Service]
    end
    
    subgraph "Data Layer"
        POSTGRES[(PostgreSQL)]
        REDIS[(Redis)]
    end
    
    WEB --> AUTH
    API_CLIENT --> AUTH
    AUTH --> AGENTS
    AUTH --> DASHBOARD
    AUTH --> SUBSCRIPTIONS
    
    AGENTS --> AI_SERVICE
    DASHBOARD --> MONITORING
    SUBSCRIPTIONS --> NOTIFICATIONS
    
    AI_SERVICE --> POSTGRES
    MONITORING --> REDIS
    NOTIFICATIONS --> POSTGRES
```

## ✅ Implementation Status

### 🎯 **Fully Implemented Features**
- ✅ **Authentication System** - JWT-based auth with user management
- ✅ **AI Agent Management** - Complete CRUD operations with LangChain integration
- ✅ **Dashboard Analytics** - Overview, performance, alerts, revenue tracking
- ✅ **Subscription Management** - Plans, billing, usage tracking, limits
- ✅ **Real-time Monitoring** - WebSocket integration for live updates
- ✅ **Multi-chain Support** - Ethereum, Solana, Cosmos integration
- ✅ **Alert System** - Multi-channel notifications and management
- ✅ **Database Schema** - Complete PostgreSQL schema with relationships
- ✅ **API Documentation** - Comprehensive API reference
- ✅ **Docker Deployment** - Production-ready containerization

### 🚧 **In Development**
- 🔄 **Frontend Dashboard** - React-based web interface
- 🔄 **Mobile App** - React Native mobile application
- 🔄 **Advanced AI Tools** - Additional blockchain-specific agent tools
- 🔄 **Performance Optimization** - Caching and query optimization

### 📋 **Planned Features**
- 📅 **Multi-tenant Support** - Organization and team management
- 📅 **Advanced Analytics** - Machine learning insights and predictions
- 📅 **API Rate Limiting** - Advanced rate limiting and quotas
- 📅 **Audit Logging** - Comprehensive audit trail and compliance

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL 13+
- Redis 6.0+
- Docker (optional)

### 1. Clone and Install
```bash
git clone https://github.com/mentisprotocol/mentis-app.git
cd mentis-app
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Database Setup
```bash
# Using Docker (recommended)
docker-compose up -d postgres redis

# Or install locally and run migrations
npm run migrate
```

### 4. Start Development Server
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## 🆘 Support

- **Documentation**: [docs.mentisprotocol.ai](https://docs.mentisprotocol.ai)
- **Support**: [info@mentisprotocol.ai](mailto:info@mentisprotocol.ai)
