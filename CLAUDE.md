# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Twilio MCP Server - A Model Context Protocol (MCP) server that enables AI-powered SMS messaging with intelligent conversation management through Twilio's API. Provides tools for sending SMS, receiving webhooks, and managing conversation threads with SQLite persistence.

## Build & Development Commands

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
npm run test:watch
npm run test:coverage
```

## Architecture Overview

### Dual Server Design

This project runs TWO separate servers simultaneously:

1. **MCP Server** (stdio transport) - Communicates with Claude Code via stdio, exposes tools
2. **Express Webhook Server** (HTTP) - Receives inbound SMS and status callbacks from Twilio

### Entry Points

- `src/index.ts` - Starts MCP server on stdio (used by Claude Code)
- `src/webhook-server.ts` - Can be run standalone for webhook testing
- When running via `npm run dev`, only the MCP server starts. The webhook server must be started separately or within the MCP server startup logic.

### Core Components

**MCP Layer** (`src/server.ts`)
- Registers 5 MCP tools: `send_sms`, `get_inbound_messages`, `create_conversation`, `get_conversation_thread`, `get_message_status`
- All tool handlers return JSON responses via MCP's content protocol
- Uses `@modelcontextprotocol/sdk` for stdio transport

**Webhook Layer** (`src/webhook-server.ts`)
- Express server on configurable port (default 3000)
- Two endpoints: `/webhooks/twilio/sms` (inbound messages), `/webhooks/twilio/status` (delivery updates)
- Validates all webhooks using Twilio signature verification
- Auto-creates conversations when `AUTO_CREATE_CONVERSATIONS=true`

**Storage Layer** (`src/storage/`)
- `conversation-store.ts` - SQLite persistence for conversation threads
- `message-store.ts` - SQLite persistence for SMS/MMS messages
- Both use better-sqlite3 with synchronous API
- Participant matching uses normalized key (`[+1111, +2222]` → `+1111|+2222`)

**Tool Implementations** (`src/tools/`)
- Each tool is a standalone async function that validates inputs with Zod
- Tools use singleton instances of `twilioClient`, `conversationStore`, `messageStore`
- All tools handle errors and return structured responses

### Data Flow

**Outbound SMS:**
1. Claude Code calls `send_sms` MCP tool
2. Tool finds or creates conversation by participants
3. Twilio API sends SMS via `twilio-client.ts`
4. Message stored in SQLite with status "queued"
5. Twilio sends status updates to webhook endpoint
6. Webhook updates message status in database

**Inbound SMS:**
1. Twilio sends POST to `/webhooks/twilio/sms`
2. Webhook validates signature
3. Finds or creates conversation by participants
4. Stores message in database
5. Updates conversation last_activity timestamp
6. Responds with empty TwiML

### Conversation Threading

Conversations are matched by **normalized participant pairs**:
- Phone numbers are sorted alphabetically to create a unique key
- `[+15551234567, +15559876543]` becomes `+15551234567|+15559876543`
- Bidirectional matching: messages from A→B and B→A link to same conversation
- Auto-creation can be disabled via `AUTO_CREATE_CONVERSATIONS=false`

## Environment Configuration

All configuration uses Zod validation in `src/config/env.ts`:

**Required:**
- `TWILIO_ACCOUNT_SID` - Must start with "AC"
- `TWILIO_AUTH_TOKEN` - Min 32 characters
- `TWILIO_PHONE_NUMBER` - E.164 format (+1234567890)
- `WEBHOOK_BASE_URL` - Full HTTPS URL for production (use ngrok for dev)

**Optional:**
- `WEBHOOK_PORT` - Default 3000
- `DATABASE_PATH` - Default `./data/twilio.db`
- `LOG_LEVEL` - debug/info/warn/error (default: info)
- `AUTO_CREATE_CONVERSATIONS` - Default true
- `ENABLE_AI_CONTEXT` - Default true (reserved for future AI summarization)
- `ENABLE_MMS` - Default true

## Testing Strategy

### Local Testing with ngrok

1. Start MCP server: `npm run dev`
2. In separate terminal: `ngrok http 3000`
3. Copy ngrok HTTPS URL to `WEBHOOK_BASE_URL` in `.env`
4. Configure Twilio webhooks in console:
   - Messaging: `https://xxxxx.ngrok.io/webhooks/twilio/sms`
   - Status: `https://xxxxx.ngrok.io/webhooks/twilio/status`

### Unit Testing

- Uses Jest with ts-jest for TypeScript support
- Supertest for HTTP endpoint testing
- Test files should be in `tests/` directory (currently not implemented)

## Common Development Tasks

### Adding a New MCP Tool

1. Create tool function in `src/tools/your-tool.ts`
2. Define Zod schema for input validation
3. Add tool definition to `src/server.ts` in `ListToolsRequestSchema` handler
4. Add tool case to `CallToolRequestSchema` switch statement
5. Export tool from its file
6. Rebuild: `npm run build`

### Modifying Database Schema

1. Update schema in `storage/conversation-store.ts` or `storage/message-store.ts`
2. Delete existing database: `rm -rf data/twilio.db`
3. Rebuild and restart to recreate tables
4. **Note:** No migrations system implemented - schema changes require fresh DB

### Debugging Webhook Issues

1. Check ngrok web interface: `http://localhost:4040`
2. Verify webhook signature validation is passing
3. Check Express server logs (uses `console.error` for visibility)
4. Test signature validation with Twilio's validation library
5. Ensure `WEBHOOK_BASE_URL` exactly matches ngrok URL (including https://)

## Type Safety

- Strict TypeScript configuration in `tsconfig.json`
- `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns` enabled
- All inputs validated with Zod schemas before processing
- Type definitions in `src/types/models.ts`

## Security Considerations

- Webhook signature validation on every inbound request
- No secrets in code - all credentials via environment variables
- Input validation with Zod prevents injection attacks
- HTTPS required for production webhooks
- E.164 phone number format validation

## SQLite Database

**Tables:**
- `conversations` - id (UUID), participants (pipe-delimited), timestamps, metadata (JSON), status
- `messages` - message_sid (PK), conversation_id (FK), direction, from/to, body, media_urls (JSON), status, error details

**Indexes:**
- `conversations.participants` - Fast participant lookup
- `conversations.last_activity` - Sorted conversation queries

Database is initialized automatically on first import of store modules.

## Module System

- Uses ES modules (`"type": "module"` in package.json)
- All imports must include `.js` extension (TypeScript requirement for Node16 module resolution)
- Top-level await supported (used in store initialization)

## MCP Integration with Claude Code

Add to Claude Code config:

```json
{
  "mcpServers": {
    "twilio": {
      "command": "node",
      "args": ["/absolute/path/to/twilio-mcp/dist/index.js"],
      "env": {
        "TWILIO_ACCOUNT_SID": "ACxxxxx",
        "TWILIO_AUTH_TOKEN": "token",
        "TWILIO_PHONE_NUMBER": "+1234567890",
        "WEBHOOK_PORT": "3000",
        "WEBHOOK_BASE_URL": "https://your-ngrok-url.ngrok.io",
        "DATABASE_PATH": "./data/twilio.db"
      }
    }
  }
}
```

Restart Claude Code after changes to see updated tools.
