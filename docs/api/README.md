# Mentis Protocol API Documentation

This directory contains comprehensive API documentation for the Mentis Protocol backend.

## Available Documentation

- **OpenAPI Specification**: `openapi.yaml` - Complete API specification
- **Interactive Documentation**: Access Swagger UI at `/api/docs` when server is running
- **Postman Collection**: `mentis-api.postman_collection.json` - Ready-to-use API collection

## Quick Start

### Base URL
```
Development: http://localhost:3000/api
Production: https://api.mentisprotocol.ai/api
```

### Authentication
All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Response Format
All API responses follow this standard format:
```json
{
  "success": true|false,
  "data": <response_data>,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  },
  "message": "Optional success message"
}
```

## API Endpoints Overview

### Authentication (`/api/auth`)
- `POST /register` - User registration
- `POST /login` - User login  
- `GET /profile` - Get user profile

### Agents (`/api/agents`)
- `GET /` - List user agents
- `POST /` - Create new agent
- `GET /:id` - Get agent details
- `PUT /:id` - Update agent
- `DELETE /:id` - Delete agent
- `POST /:id/start` - Start agent monitoring
- `POST /:id/stop` - Stop agent monitoring
- `POST /:id/execute` - Execute agent task
- `GET /:id/metrics` - Get agent metrics
- `GET /:id/alerts` - Get agent alerts
- `PUT /:id/alerts/:alertId/resolve` - Resolve alert

### Dashboard (`/api/dashboard`)
- `GET /overview` - Dashboard overview stats
- `GET /performance` - Performance metrics
- `GET /alerts` - Alert summary
- `GET /revenue` - Revenue data
- `GET /health` - System health status

### Subscriptions (`/api/subscriptions`)
- `GET /plans` - Available subscription plans
- `GET /` - Current user subscription
- `PUT /` - Update subscription
- `DELETE /` - Cancel subscription
- `GET /usage` - Subscription usage
- `GET /billing-history` - Billing history
- `GET /can-create-agent` - Check agent creation limit
- `GET /can-use-chain/:chain` - Check chain access

## Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Invalid or missing authentication token |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Request validation failed |
| `RATE_LIMITED` | Too many requests |
| `SUBSCRIPTION_REQUIRED` | Feature requires active subscription |
| `AGENT_LIMIT_EXCEEDED` | Maximum agents reached for plan |
| `CHAIN_NOT_SUPPORTED` | Chain not supported by current plan |

## Rate Limiting

API requests are rate limited per user:
- **Starter Plan**: 100 requests/hour
- **Core Plan**: 1,000 requests/hour  
- **Enterprise Plan**: 10,000 requests/hour

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## WebSocket Events

Connect to WebSocket at `/socket.io` for real-time updates:

### Client → Server
- `join-agent-room` - Join agent-specific room

### Server → Client
- `metrics` - Real-time agent metrics
- `alert` - New alert notification
- `status_change` - Agent status change
- `system_status` - System health update


## Examples

### Create an Agent
```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ethereum Validator Monitor",
    "description": "AI agent for monitoring Ethereum validator",
    "chain": "ethereum",
    "node_type": "validator",
    "endpoint_url": "https://your-node.com",
    "config": {
      "llmProvider": "openai",
      "model": "gpt-4o-mini"
    }
  }'
```

### Get Dashboard Overview
```bash
curl -X GET http://localhost:3000/api/dashboard/overview \
  -H "Authorization: Bearer <token>"
```

### Execute Agent Task
```bash
curl -X POST http://localhost:3000/api/agents/{id}/execute \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "taskType": "monitor",
    "parameters": {
      "checkInterval": 60
    }
  }'
```

## Support

- **Documentation**: [docs.mentisprotocol.ai](https://docs.mentisprotocol.ai)
- **Support**: [info@mentisprotocol.ai](mailto:info@mentisprotocol.ai)
