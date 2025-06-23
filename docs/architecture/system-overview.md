# Mentis Protocol System Architecture

This document provides a comprehensive overview of the Mentis Protocol system architecture, including service relationships, data flow, and deployment patterns.

## High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Dashboard]
        MOBILE[Mobile App]
        CLI[CLI Tool]
        API_CLIENT[API Clients]
    end

    subgraph "API Gateway"
        LB[Load Balancer]
        RATE[Rate Limiter]
        AUTH[Authentication]
    end

    subgraph "Application Layer"
        API[Express.js API Server]
        WS[WebSocket Server]
        WORKER[Background Workers]
    end

    subgraph "Service Layer"
        AGENT_SVC[Agent Service]
        AI_SVC[AI Agent Service]
        MONITOR_SVC[Monitoring Service]
        DASH_SVC[Dashboard Service]
        SUB_SVC[Subscription Service]
        NOTIF_SVC[Notification Service]
    end

    subgraph "AI/ML Layer"
        LANGCHAIN[LangChain Framework]
        OPENAI[OpenAI]
        ANTHROPIC[Anthropic Claude]
        TOOLS[Agent Tools]
    end

    subgraph "Data Layer"
        POSTGRES[(PostgreSQL)]
        REDIS[(Redis Cache)]
        METRICS[(Time Series DB)]
    end

    subgraph "External Services"
        ETH[Ethereum RPC]
        SOL[Solana RPC]
        COSMOS[Cosmos RPC]
        EMAIL[Email Service]
        SLACK[Slack API]
        TELEGRAM[Telegram Bot]
    end

    WEB --> LB
    MOBILE --> LB
    CLI --> LB
    API_CLIENT --> LB

    LB --> RATE
    RATE --> AUTH
    AUTH --> API
    AUTH --> WS

    API --> AGENT_SVC
    API --> DASH_SVC
    API --> SUB_SVC
    WS --> MONITOR_SVC
    WS --> NOTIF_SVC

    AGENT_SVC --> AI_SVC
    AI_SVC --> LANGCHAIN
    LANGCHAIN --> OPENAI
    LANGCHAIN --> ANTHROPIC
    LANGCHAIN --> TOOLS

    MONITOR_SVC --> METRICS
    DASH_SVC --> POSTGRES
    SUB_SVC --> POSTGRES
    AGENT_SVC --> POSTGRES
    
    API --> REDIS
    WS --> REDIS

    TOOLS --> ETH
    TOOLS --> SOL
    TOOLS --> COSMOS

    NOTIF_SVC --> EMAIL
    NOTIF_SVC --> SLACK
    NOTIF_SVC --> TELEGRAM
```

## Service Architecture

### Core Services

#### 1. Agent Service
**Responsibility**: Manages AI agent lifecycle and configuration
- Agent CRUD operations
- Agent status management
- Configuration validation
- Task orchestration

#### 2. AI Agent Service
**Responsibility**: Handles AI-powered agent operations
- LangChain integration
- LLM provider management
- Tool execution
- Decision making workflows

#### 3. Monitoring Service
**Responsibility**: Real-time monitoring and metrics collection
- Node health monitoring
- Performance metrics
- Alert generation
- WebSocket event broadcasting

#### 4. Dashboard Service
**Responsibility**: Analytics and reporting
- Data aggregation
- Performance analytics
- Revenue tracking
- System health monitoring

#### 5. Subscription Service
**Responsibility**: Subscription and billing management
- Plan management
- Usage tracking
- Billing operations
- Access control

#### 6. Notification Service
**Responsibility**: Multi-channel notifications
- Alert routing
- Channel management
- Message formatting
- Delivery tracking

## Data Flow Architecture

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant AgentService
    participant AIService
    participant MonitoringService
    participant Database
    participant BlockchainRPC

    Client->>API: Create Agent Request
    API->>AgentService: Validate & Create Agent
    AgentService->>Database: Store Agent Config
    AgentService->>AIService: Initialize AI Agent
    AIService->>MonitoringService: Start Monitoring
    
    loop Monitoring Cycle
        MonitoringService->>BlockchainRPC: Health Check
        BlockchainRPC-->>MonitoringService: Node Status
        MonitoringService->>AIService: Analyze Data
        AIService->>AIService: AI Decision Making
        AIService-->>MonitoringService: Actions/Alerts
        MonitoringService->>Database: Store Metrics
        MonitoringService->>Client: WebSocket Update
    end

    Note over AIService: AI Agent continuously monitors,<br/>analyzes, and takes actions<br/>based on blockchain data
```

## AI Agent Workflow

```mermaid
graph TD
    START[Agent Started] --> INIT[Initialize AI Agent]
    INIT --> CONFIG[Load Configuration]
    CONFIG --> TOOLS[Setup Tools]
    TOOLS --> MONITOR[Start Monitoring Loop]
    
    MONITOR --> COLLECT[Collect Data]
    COLLECT --> ANALYZE[AI Analysis]
    ANALYZE --> DECISION{Decision Required?}
    
    DECISION -->|Yes| ACTION[Execute Action]
    DECISION -->|No| WAIT[Wait Interval]
    
    ACTION --> VALIDATE[Validate Result]
    VALIDATE --> LOG[Log Activity]
    LOG --> ALERT{Generate Alert?}
    
    ALERT -->|Yes| NOTIFY[Send Notification]
    ALERT -->|No| WAIT
    NOTIFY --> WAIT
    
    WAIT --> MONITOR
    
    subgraph "AI Tools"
        HEALTH[Health Check]
        METRICS[Collect Metrics]
        RESTART[Restart Node]
        ALERT_TOOL[Create Alert]
        QUERY[Query Database]
    end
    
    ACTION --> HEALTH
    ACTION --> METRICS
    ACTION --> RESTART
    ACTION --> ALERT_TOOL
    ACTION --> QUERY
```

## Deployment Architecture

### Development Environment
```mermaid
graph LR
    subgraph "Local Development"
        DEV[Developer Machine]
        DOCKER[Docker Compose]
        LOCAL_DB[(Local PostgreSQL)]
        LOCAL_REDIS[(Local Redis)]
    end

    DEV --> DOCKER
    DOCKER --> LOCAL_DB
    DOCKER --> LOCAL_REDIS
```

### Production Environment
```mermaid
graph TB
    subgraph "Load Balancer Tier"
        ALB[Application Load Balancer]
        WAF[Web Application Firewall]
    end

    subgraph "Application Tier"
        APP1[API Server 1]
        APP2[API Server 2]
        APP3[API Server 3]
        WORKER1[Worker 1]
        WORKER2[Worker 2]
    end

    subgraph "Database Tier"
        PG_PRIMARY[(PostgreSQL Primary)]
        PG_REPLICA[(PostgreSQL Replica)]
        REDIS_CLUSTER[(Redis Cluster)]
        METRICS_DB[(InfluxDB)]
    end

    subgraph "Monitoring"
        PROMETHEUS[Prometheus]
        GRAFANA[Grafana]
        ALERTMANAGER[AlertManager]
    end

    WAF --> ALB
    ALB --> APP1
    ALB --> APP2
    ALB --> APP3

    APP1 --> PG_PRIMARY
    APP2 --> PG_PRIMARY
    APP3 --> PG_PRIMARY
    
    APP1 --> PG_REPLICA
    APP2 --> PG_REPLICA
    APP3 --> PG_REPLICA

    APP1 --> REDIS_CLUSTER
    APP2 --> REDIS_CLUSTER
    APP3 --> REDIS_CLUSTER

    WORKER1 --> METRICS_DB
    WORKER2 --> METRICS_DB

    PROMETHEUS --> APP1
    PROMETHEUS --> APP2
    PROMETHEUS --> APP3
    PROMETHEUS --> ALERTMANAGER
    GRAFANA --> PROMETHEUS
```

## Security Architecture

```mermaid
graph TB
    subgraph "Security Layers"
        WAF[Web Application Firewall]
        RATE_LIMIT[Rate Limiting]
        AUTH[JWT Authentication]
        RBAC[Role-Based Access Control]
        ENCRYPTION[Data Encryption]
        AUDIT[Audit Logging]
    end

    subgraph "Network Security"
        VPC[Virtual Private Cloud]
        SUBNET[Private Subnets]
        SG[Security Groups]
        NACL[Network ACLs]
    end

    subgraph "Data Security"
        ENCRYPT_REST[Encryption at Rest]
        ENCRYPT_TRANSIT[Encryption in Transit]
        KEY_MGMT[Key Management]
        BACKUP_ENCRYPT[Encrypted Backups]
    end

    WAF --> RATE_LIMIT
    RATE_LIMIT --> AUTH
    AUTH --> RBAC
    RBAC --> ENCRYPTION
    ENCRYPTION --> AUDIT

    VPC --> SUBNET
    SUBNET --> SG
    SG --> NACL

    ENCRYPT_REST --> KEY_MGMT
    ENCRYPT_TRANSIT --> KEY_MGMT
    BACKUP_ENCRYPT --> KEY_MGMT
```


## Performance Optimization

### Caching Strategy
```mermaid
graph LR
    CLIENT[Client] --> CDN[CDN Cache]
    CDN --> LB[Load Balancer]
    LB --> APP[Application]
    APP --> REDIS[Redis Cache]
    REDIS --> DB[(Database)]
    
    subgraph "Cache Layers"
        CDN_CACHE[Static Assets<br/>TTL: 24h]
        REDIS_CACHE[API Responses<br/>TTL: 5m]
        APP_CACHE[In-Memory<br/>TTL: 1m]
    end
```

### Database Optimization
- **Indexing**: Strategic indexes on frequently queried columns
- **Partitioning**: Time-based partitioning for metrics tables
- **Connection Pooling**: Efficient database connection management
- **Query Optimization**: Optimized queries with EXPLAIN analysis

## Monitoring and Observability

### Metrics Collection
- **Application Metrics**: Response times, error rates, throughput
- **Infrastructure Metrics**: CPU, memory, disk, network
- **Business Metrics**: Agent count, subscription revenue, user activity
- **AI Metrics**: Model performance, token usage, decision accuracy

### Logging Strategy
- **Structured Logging**: JSON format with consistent fields
- **Log Levels**: DEBUG, INFO, WARN, ERROR, FATAL
- **Centralized Logging**: ELK stack or similar
- **Log Retention**: 30 days for application logs, 90 days for errors

### Alerting Rules
- **Critical**: System down, database unavailable
- **Warning**: High error rate, slow response times
- **Info**: Deployment notifications, scaling events

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React, TypeScript | Web dashboard |
| **API** | Node.js, Express.js | REST API server |
| **AI/ML** | LangChain, OpenAI, Anthropic | AI agent framework |
| **Database** | PostgreSQL, Redis | Data persistence and caching |
| **Monitoring** | Prometheus, Grafana | Metrics and visualization |
| **Queue** | Redis, Bull | Background job processing |
| **Blockchain** | Ethers.js, Solana Web3.js | Blockchain integration |
| **Deployment** | Docker, Kubernetes | Container orchestration |
| **CI/CD** | GitHub Actions | Automated deployment |
| **Security** | JWT, bcrypt, Helmet | Authentication and security |
