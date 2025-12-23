# Twilio MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![MCP Protocol](https://img.shields.io/badge/MCP-1.0-purple.svg)](https://modelcontextprotocol.io)

A Model Context Protocol (MCP) server that enables AI-powered SMS messaging with intelligent conversation management through Twilio's API. This server allows AI clients like Claude Desktop and Claude Code to send and receive SMS messages, manage conversation threads, and track message delivery status.

## ✨ Features

- **📱 Send SMS** - Send text messages via Twilio with automatic conversation threading
- **📥 Receive SMS** - Process inbound messages via webhooks with automatic storage
- **💬 Conversation Management** - Track and manage multi-turn SMS conversations
- **📊 Message Status** - Check delivery status of sent messages in real-time
- **🔗 Thread Association** - Automatically link messages to conversation threads
- **🖼️ MMS Support** - Send and receive multimedia messages (optional)
- **💾 SQLite Persistence** - Local storage for offline access and message history
- **🔒 Secure Webhooks** - Twilio signature validation on all incoming requests

## 📋 Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
  - [Claude Desktop Integration](#claude-desktop-integration)
  - [Claude Code Integration](#claude-code-integration)
- [API Reference](#api-reference)
  - [send_sms](#send_sms)
  - [get_inbound_messages](#get_inbound_messages)
  - [create_conversation](#create_conversation)
  - [get_conversation_thread](#get_conversation_thread)
  - [get_message_status](#get_message_status)
- [Webhook Setup](#webhook-setup)
- [Development](#development)
- [Architecture](#architecture)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## 🚀 Installation

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn
- A Twilio account with:
  - Account SID
  - Auth Token
  - Phone number (SMS-enabled)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/twilio-mcp.git
cd twilio-mcp

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your Twilio credentials
# Then build the project
npm run build
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the project root with the following variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TWILIO_ACCOUNT_SID` | ✅ Yes | - | Twilio Account SID (starts with "AC") |
| `TWILIO_AUTH_TOKEN` | ✅ Yes | - | Twilio Auth Token (32+ characters) |
| `TWILIO_PHONE_NUMBER` | ✅ Yes | - | Your Twilio phone number in E.164 format |
| `WEBHOOK_BASE_URL` | ✅ Yes | - | Public HTTPS URL for webhook callbacks |
| `WEBHOOK_PORT` | No | `3000` | Port for the webhook HTTP server |
| `DATABASE_PATH` | No | `./data/twilio.db` | SQLite database file path |
| `LOG_LEVEL` | No | `info` | Logging level (debug, info, warn, error) |
| `AUTO_CREATE_CONVERSATIONS` | No | `true` | Auto-create threads for new message pairs |
| `ENABLE_AI_CONTEXT` | No | `true` | Enable AI context generation (reserved) |
| `ENABLE_MMS` | No | `true` | Enable MMS multimedia message support |

### Example `.env` File

```bash
# Twilio Credentials (from https://console.twilio.com)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here_min_32_chars
TWILIO_PHONE_NUMBER=+1234567890

# Webhook Configuration
WEBHOOK_PORT=3000
WEBHOOK_BASE_URL=https://your-ngrok-url.ngrok.io

# Database
DATABASE_PATH=./data/twilio.db

# Optional Settings
LOG_LEVEL=info
AUTO_CREATE_CONVERSATIONS=true
ENABLE_MMS=true
```

## 📖 Usage

### Claude Desktop Integration

Add the Twilio MCP server to your Claude Desktop configuration file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "twilio": {
      "command": "node",
      "args": ["/absolute/path/to/twilio-mcp/dist/index.js"],
      "env": {
        "TWILIO_ACCOUNT_SID": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "TWILIO_AUTH_TOKEN": "your_auth_token_here",
        "TWILIO_PHONE_NUMBER": "+1234567890",
        "WEBHOOK_PORT": "3000",
        "WEBHOOK_BASE_URL": "https://your-webhook-url.ngrok.io",
        "DATABASE_PATH": "./data/twilio.db"
      }
    }
  }
}
```

After saving, restart Claude Desktop to load the new MCP server.

### Claude Code Integration

For Claude Code, add the server to your MCP configuration:

```json
{
  "mcpServers": {
    "twilio": {
      "command": "node",
      "args": ["/path/to/twilio-mcp/dist/index.js"],
      "env": {
        "TWILIO_ACCOUNT_SID": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "TWILIO_AUTH_TOKEN": "your_auth_token",
        "TWILIO_PHONE_NUMBER": "+1234567890",
        "WEBHOOK_PORT": "3000",
        "WEBHOOK_BASE_URL": "https://your-ngrok-url.ngrok.io"
      }
    }
  }
}
```

### Example Conversations with Claude

Once configured, you can ask Claude to perform SMS operations:

```
"Send a text message to +1234567890 saying 'Hello from Claude!'"

"Check if I have any new text messages"

"What's the delivery status of my last sent message?"

"Show me the conversation history with +1234567890"

"Create a new conversation thread with +1234567890 and +1987654321"
```

## 📚 API Reference

### send_sms

Send an SMS message via Twilio with automatic conversation threading.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `to` | string | ✅ | Recipient phone number in E.164 format |
| `message` | string | ✅ | SMS content (1-1600 characters) |
| `from` | string | No | Sender phone number (uses default if omitted) |
| `conversationId` | string | No | UUID of existing conversation to link to |

**Example Request:**

```json
{
  "to": "+1234567890",
  "message": "Hello from Twilio MCP! This is a test message."
}
```

**Example Response:**

```json
{
  "messageSid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "status": "queued",
  "to": "+1234567890",
  "from": "+1987654321",
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

---

### get_inbound_messages

Query received SMS/MMS messages from local storage with optional filters.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `from` | string | No | Filter by sender phone number |
| `to` | string | No | Filter by recipient phone number |
| `conversationId` | string | No | Filter by conversation UUID |
| `since` | string | No | ISO 8601 timestamp to filter messages after |
| `limit` | number | No | Max messages to return (1-1000, default: 50) |

**Example Request:**

```json
{
  "from": "+1234567890",
  "limit": 10
}
```

**Example Response:**

```json
{
  "messages": [
    {
      "messageSid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "from": "+1234567890",
      "to": "+1987654321",
      "body": "Hey, got your message!",
      "timestamp": "2025-01-15T10:35:00.000Z",
      "conversationId": "550e8400-e29b-41d4-a716-446655440000",
      "status": "received",
      "direction": "inbound"
    }
  ],
  "totalCount": 1
}
```

---

### create_conversation

Initialize a new conversation thread between participants.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `participants` | string[] | ✅ | Array of phone numbers in E.164 format (min 2) |
| `metadata` | object | No | Custom metadata to attach |

**Example Request:**

```json
{
  "participants": ["+1234567890", "+1987654321"],
  "metadata": {
    "campaign": "customer-support",
    "priority": "high",
    "ticketId": "TICKET-123"
  }
}
```

**Example Response:**

```json
{
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "participants": ["+1234567890", "+1987654321"],
  "createdAt": "2025-01-15T10:30:00.000Z",
  "metadata": {
    "campaign": "customer-support",
    "priority": "high",
    "ticketId": "TICKET-123"
  }
}
```

---

### get_conversation_thread

Retrieve full conversation history with all messages.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `conversationId` | string | ✅ | UUID of the conversation |
| `includeContext` | boolean | No | Include AI context summary (default: false) |

**Example Request:**

```json
{
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "includeContext": true
}
```

**Example Response:**

```json
{
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "participants": ["+1234567890", "+1987654321"],
  "messages": [
    {
      "messageSid": "SMxxxxxxx",
      "direction": "outbound",
      "from": "+1987654321",
      "to": "+1234567890",
      "body": "Hello!",
      "timestamp": "2025-01-15T10:30:00.000Z",
      "status": "delivered"
    },
    {
      "messageSid": "SMyyyyyyy",
      "direction": "inbound",
      "from": "+1234567890",
      "to": "+1987654321",
      "body": "Hi there! How can I help?",
      "timestamp": "2025-01-15T10:31:00.000Z",
      "status": "received"
    }
  ],
  "context": {
    "summary": "Conversation with 2 participants",
    "lastActivity": "2025-01-15T10:31:00.000Z",
    "messageCount": 2
  }
}
```

---

### get_message_status

Check the delivery status of a sent message.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `messageSid` | string | ✅ | Twilio message SID (starts with SM or MM) |

**Example Request:**

```json
{
  "messageSid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

**Example Response (Delivered):**

```json
{
  "messageSid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "status": "delivered",
  "timestamp": "2025-01-15T10:31:00.000Z",
  "to": "+1234567890",
  "from": "+1987654321"
}
```

**Example Response (Failed):**

```json
{
  "messageSid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "status": "undelivered",
  "errorCode": 30003,
  "errorMessage": "Unreachable destination handset",
  "timestamp": "2025-01-15T10:31:00.000Z",
  "to": "+1234567890",
  "from": "+1987654321"
}
```

## 🌐 Webhook Setup

For the server to receive inbound SMS messages, you need to configure Twilio webhooks.

### Development (Using ngrok)

1. **Install ngrok:** https://ngrok.com/download

2. **Start the webhook server:**
   ```bash
   npm run dev
   ```

3. **In another terminal, start ngrok:**
   ```bash
   ngrok http 3000
   ```

4. **Copy the HTTPS URL** from ngrok (e.g., `https://abc123.ngrok.io`)

5. **Update your `.env`:**
   ```bash
   WEBHOOK_BASE_URL=https://abc123.ngrok.io
   ```

6. **Configure Twilio webhooks:**
   - Go to [Twilio Console > Phone Numbers](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
   - Select your phone number
   - Under "Messaging Configuration":
     - **Webhook URL:** `https://abc123.ngrok.io/webhooks/twilio/sms`
     - **HTTP Method:** POST
   - Under "Status Callback URL" (optional):
     - **URL:** `https://abc123.ngrok.io/webhooks/twilio/status`
   - Click Save

### Production

Deploy the webhook server to a production environment with HTTPS:

1. Deploy to your hosting platform (AWS, GCP, Heroku, etc.)
2. Configure SSL/TLS certificates
3. Update `WEBHOOK_BASE_URL` to your production URL
4. Update Twilio webhook URLs in the console

## 🛠️ Development

### Commands

```bash
# Install dependencies
npm install

# Build TypeScript to dist/
npm run build

# Development mode with auto-reload
npm run dev

# Type checking (no emit)
npm run lint

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Project Structure

```
twilio-mcp/
├── src/
│   ├── index.ts                 # MCP server entry point
│   ├── server.ts                # MCP server with tool registry
│   ├── webhook-server.ts        # Express server for webhooks
│   ├── config/
│   │   └── env.ts               # Environment configuration
│   ├── services/
│   │   └── twilio-client.ts     # Twilio SDK wrapper
│   ├── storage/
│   │   ├── conversation-store.ts # Conversation persistence
│   │   └── message-store.ts      # Message persistence
│   ├── tools/
│   │   ├── send-sms.ts
│   │   ├── get-inbound-messages.ts
│   │   ├── create-conversation.ts
│   │   ├── get-conversation-thread.ts
│   │   └── get-message-status.ts
│   └── types/
│       └── models.ts            # TypeScript type definitions
├── data/                        # SQLite database storage
├── dist/                        # Compiled JavaScript output
└── tests/                       # Test files
```

### Adding a New MCP Tool

1. **Create the tool file** in `src/tools/your-tool.ts`:
   ```typescript
   import { z } from 'zod';
   
   export const yourToolSchema = z.object({
     // Define your input schema
   });
   
   export type YourToolParams = z.infer<typeof yourToolSchema>;
   
   export async function yourTool(params: YourToolParams) {
     const validated = yourToolSchema.parse(params);
     // Implement your tool logic
     return { /* response */ };
   }
   ```

2. **Register in `src/server.ts`**:
   - Add to `ListToolsRequestSchema` handler
   - Add case to `CallToolRequestSchema` switch

3. **Build and test:**
   ```bash
   npm run build
   ```

### Database Schema Changes

The server uses SQLite with no migration system. To modify the schema:

1. Update schema in relevant store file
2. Delete the database: `rm -rf data/twilio.db`
3. Rebuild and restart to recreate tables

## 🏗️ Architecture

### Dual Server Design

This project runs **two servers simultaneously**:

1. **MCP Server** (stdio transport)
   - Communicates with AI clients via stdio
   - Exposes tools for SMS operations
   - Handles tool registration and execution

2. **Express Webhook Server** (HTTP)
   - Receives inbound SMS from Twilio
   - Processes delivery status callbacks
   - Validates webhook signatures

### Data Flow

**Outbound SMS:**
```
AI Client → MCP Server → send_sms tool → Twilio API → Recipient
                              ↓
                        SQLite Storage
                              ↑
Twilio Status Callback → Webhook Server
```

**Inbound SMS:**
```
Sender → Twilio → Webhook Server → SQLite Storage
                                         ↓
                       AI Client ← MCP Server (query tools)
```

### Conversation Threading

Conversations are matched by **normalized participant pairs**:
- Phone numbers sorted alphabetically → unique key
- `[+15551234567, +15559876543]` → `+15551234567|+15559876543`
- Bidirectional: A→B and B→A match the same conversation

## 🔒 Security

### Best Practices Implemented

- **No Hardcoded Secrets** - All credentials via environment variables
- **Webhook Validation** - Twilio signature verification on every request
- **Input Validation** - Zod schemas validate all tool inputs
- **HTTPS Required** - Webhook endpoints require HTTPS in production
- **E.164 Validation** - Phone number format validation prevents injection
- **Parameterized Queries** - SQLite queries use parameters, not string concatenation

### Security Recommendations

1. **Rotate Auth Tokens** regularly in the Twilio console
2. **Use environment-specific databases** (dev/staging/prod)
3. **Monitor webhook logs** for suspicious activity
4. **Enable Twilio's built-in security features** (geo permissions, etc.)

## 🐛 Troubleshooting

### Common Issues

**"Environment validation failed"**
- Ensure all required env vars are set
- Check `TWILIO_ACCOUNT_SID` starts with "AC"
- Check `TWILIO_AUTH_TOKEN` is 32+ characters
- Check phone number is E.164 format (+1234567890)

**"Invalid webhook signature"**
- Ensure `WEBHOOK_BASE_URL` exactly matches ngrok URL
- Check URL includes `https://` prefix
- Restart the server after URL changes

**"No conversation found and auto-creation is disabled"**
- Set `AUTO_CREATE_CONVERSATIONS=true` in .env
- Or manually create conversation first with `create_conversation`

**Messages not appearing in get_inbound_messages**
- Verify webhook URL is correctly configured in Twilio
- Check ngrok is running and URL hasn't changed
- Review webhook server logs for errors

### Debugging Tips

1. **Check ngrok dashboard:** http://localhost:4040
2. **Review server logs** for webhook validation errors
3. **Test webhook manually** with curl
4. **Verify Twilio console** shows successful webhook deliveries

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🔗 Resources

- [Twilio Documentation](https://www.twilio.com/docs)
- [MCP Protocol Specification](https://modelcontextprotocol.io)
- [Twilio Console](https://console.twilio.com)
- [ngrok Documentation](https://ngrok.com/docs)

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes with appropriate tests
4. Run linting: `npm run lint`
5. Run tests: `npm test`
6. Commit your changes: `git commit -m "Add your feature"`
7. Push to the branch: `git push origin feature/your-feature`
8. Open a Pull Request

### Code Style

- TypeScript with strict mode
- JSDoc comments on all public functions
- Zod schemas for input validation
- Follow existing patterns in the codebase
