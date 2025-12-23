# Twilio MCP Server

A Model Context Protocol (MCP) server for Twilio that enables AI-powered SMS messaging with intelligent conversation management.

## Features

- **Send SMS** - Send text messages via Twilio with automatic conversation threading
- **Receive SMS** - Process inbound messages via webhooks with automatic storage
- **Conversation Management** - Track and manage multi-turn SMS conversations
- **Message Status** - Check delivery status of sent messages
- **Thread Association** - Automatically link messages to conversation threads
- **MMS Support** - Send and receive multimedia messages (optional)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd twilio-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

1. Copy the environment template:

```bash
cp .env.example .env
```

2. Fill in your Twilio credentials in `.env`:

```bash
# Get these from https://console.twilio.com
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890

# Webhook configuration
WEBHOOK_PORT=3000
WEBHOOK_BASE_URL=https://your-domain.com

# Database path
DATABASE_PATH=./data/twilio.db
```

## Setting Up Webhooks

For the server to receive inbound SMS, you need to configure Twilio webhooks:

### Development (Using ngrok)

1. Install ngrok: https://ngrok.com/download

2. Start the webhook server:

```bash
npm run dev
```

3. In another terminal, start ngrok:

```bash
ngrok http 3000
```

4. Copy the HTTPS URL from ngrok (e.g., `https://abc123.ngrok.io`)

5. Configure Twilio webhook:
   - Go to https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
   - Select your phone number
   - Under "Messaging Configuration":
     - Webhook URL: `https://abc123.ngrok.io/webhooks/twilio/sms`
     - HTTP Method: POST
   - Under "Status Callback URL":
     - URL: `https://abc123.ngrok.io/webhooks/twilio/status`
   - Save

### Production

Deploy the webhook server to a production environment with HTTPS and configure the Twilio webhook URLs accordingly.

## Usage with Claude Code

Add this server to your Claude Code MCP configuration:

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
        "WEBHOOK_BASE_URL": "https://your-webhook-url.com",
        "DATABASE_PATH": "./data/twilio.db"
      }
    }
  }
}
```

## MCP Tools

### send_sms

Send an SMS message via Twilio.

**Parameters:**
- `to` (required): Recipient phone number in E.164 format (+1234567890)
- `message` (required): SMS content (1-1600 characters)
- `from` (optional): Sender phone number (uses default if not provided)
- `conversationId` (optional): UUID of existing conversation

**Example:**
```typescript
{
  "to": "+1234567890",
  "message": "Hello from Twilio MCP!"
}
```

**Response:**
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

### get_inbound_messages

Query received SMS/MMS messages from storage.

**Parameters:**
- `from` (optional): Filter by sender phone number
- `to` (optional): Filter by recipient phone number
- `conversationId` (optional): Filter by conversation UUID
- `since` (optional): ISO 8601 timestamp to filter messages after this date
- `limit` (optional): Maximum messages to return (default: 50)

**Example:**
```typescript
{
  "from": "+1234567890",
  "limit": 10
}
```

### create_conversation

Initialize a new conversation thread.

**Parameters:**
- `participants` (required): Array of phone numbers in E.164 format (min 2)
- `metadata` (optional): Custom metadata object

**Example:**
```typescript
{
  "participants": ["+1234567890", "+1987654321"],
  "metadata": {
    "campaign": "support",
    "priority": "high"
  }
}
```

### get_conversation_thread

Retrieve full conversation history with all messages.

**Parameters:**
- `conversationId` (required): UUID of the conversation
- `includeContext` (optional): Include AI context summary (default: false)

**Example:**
```typescript
{
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "includeContext": true
}
```

### get_message_status

Check the delivery status of a sent message.

**Parameters:**
- `messageSid` (required): Twilio message SID

**Example:**
```typescript
{
  "messageSid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

**Response:**
```json
{
  "messageSid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "status": "delivered",
  "timestamp": "2025-01-15T10:31:00.000Z",
  "to": "+1234567890",
  "from": "+1987654321"
}
```

## Conversation Threading

The server automatically creates and manages conversation threads:

1. **Outbound Messages**: When sending an SMS:
   - If `conversationId` is provided, the message is linked to that conversation
   - If not provided, the server finds an existing conversation by participant pair
   - If no conversation exists and `AUTO_CREATE_CONVERSATIONS=true`, a new one is created

2. **Inbound Messages**: When receiving an SMS via webhook:
   - The server matches by participant pair (from/to numbers)
   - If no conversation exists and `AUTO_CREATE_CONVERSATIONS=true`, a new one is created
   - Messages are automatically stored and linked to the conversation

3. **Participant Matching**: Conversations are identified by normalized participant pairs:
   - `[+1234567890, +1987654321]` matches the same conversation regardless of direction

## Architecture

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
└── data/                        # SQLite database storage
```

## Development

```bash
# Run in development mode
npm run dev

# Build TypeScript
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Type check
npm run lint
```

## Testing

The project includes a comprehensive test suite using Jest with TypeScript support.

### Test Structure

```
tests/
├── setup.ts                    # Test environment setup
├── config/
│   └── env.test.ts             # Environment configuration validation tests
├── services/
│   └── twilio-client.test.ts   # Twilio client service tests
├── storage/
│   ├── conversation-store.test.ts  # Conversation persistence tests
│   └── message-store.test.ts       # Message persistence tests
├── tools/
│   ├── send-sms.test.ts            # SMS sending schema validation
│   ├── create-conversation.test.ts # Conversation creation tests
│   ├── get-conversation-thread.test.ts
│   ├── get-inbound-messages.test.ts
│   └── get-message-status.test.ts
└── webhook-server.test.ts      # Webhook endpoint tests
```

### What's Tested

- **Schema Validation**: All MCP tool input schemas are tested for valid/invalid inputs
- **Storage Operations**: SQLite conversation and message stores (CRUD operations)
- **Webhook Handlers**: Inbound SMS and status callback endpoints with signature validation
- **Environment Config**: All environment variable validation rules
- **Twilio Client**: Client instantiation and method signatures

### Running Tests

```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Test Environment

Tests use an in-memory SQLite database and mock environment variables configured in `tests/setup.ts`.

## Security

- **No Hardcoded Secrets**: All credentials are stored in environment variables
- **Webhook Validation**: All Twilio webhooks are validated using signature verification
- **Input Validation**: All tool inputs are validated using Zod schemas
- **HTTPS Required**: Webhook endpoints must use HTTPS in production

## Database

The server uses SQLite for storing conversations and messages:

- **Conversations**: Thread metadata, participants, timestamps
- **Messages**: SMS/MMS content, delivery status, media URLs

Database file location: `./data/twilio.db` (configurable via `DATABASE_PATH`)

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TWILIO_ACCOUNT_SID` | Yes | - | Twilio Account SID (starts with AC) |
| `TWILIO_AUTH_TOKEN` | Yes | - | Twilio Auth Token |
| `TWILIO_PHONE_NUMBER` | Yes | - | Your Twilio phone number (E.164 format) |
| `WEBHOOK_PORT` | No | 3000 | Port for webhook server |
| `WEBHOOK_BASE_URL` | Yes | - | Public HTTPS URL for webhooks |
| `DATABASE_PATH` | No | ./data/twilio.db | SQLite database file path |
| `LOG_LEVEL` | No | info | Logging level (debug, info, warn, error) |
| `AUTO_CREATE_CONVERSATIONS` | No | true | Auto-create conversations for new threads |
| `ENABLE_AI_CONTEXT` | No | true | Enable AI context generation |
| `ENABLE_MMS` | No | true | Enable MMS support |

## License

MIT

## Support

For issues and questions:
- Twilio Documentation: https://www.twilio.com/docs
- MCP Documentation: https://modelcontextprotocol.io
