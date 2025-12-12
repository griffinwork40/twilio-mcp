# Quick Start Guide

Get up and running with the Twilio MCP server in 5 minutes.

## Step 1: Install Dependencies

```bash
cd twilio-mcp
npm install
```

## Step 2: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your credentials
nano .env
```

Required values:
- `TWILIO_ACCOUNT_SID` - From Twilio Console
- `TWILIO_AUTH_TOKEN` - From Twilio Console
- `TWILIO_PHONE_NUMBER` - Your Twilio number (e.g., +12345678900)
- `WEBHOOK_BASE_URL` - Your public HTTPS URL (use ngrok for local dev)

## Step 3: Build the Project

```bash
npm run build
```

## Step 4: Set Up Webhooks (For Receiving SMS)

### Using ngrok (Development)

In one terminal:
```bash
npm run dev
```

In another terminal:
```bash
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`) and:
1. Update `WEBHOOK_BASE_URL` in your `.env` file
2. Configure in Twilio Console:
   - Go to Phone Numbers → Your Number
   - Set "A Message Comes In" webhook to: `https://abc123.ngrok.io/webhooks/twilio/sms`
   - Set "Status Callback" to: `https://abc123.ngrok.io/webhooks/twilio/status`

## Step 5: Add to Claude Code

Add this to your Claude Code MCP configuration:

```json
{
  "mcpServers": {
    "twilio": {
      "command": "node",
      "args": ["/absolute/path/to/twilio-mcp/dist/index.js"],
      "env": {
        "TWILIO_ACCOUNT_SID": "ACxxxxx",
        "TWILIO_AUTH_TOKEN": "your_token",
        "TWILIO_PHONE_NUMBER": "+1234567890",
        "WEBHOOK_PORT": "3000",
        "WEBHOOK_BASE_URL": "https://your-ngrok-url.ngrok.io",
        "DATABASE_PATH": "./data/twilio.db"
      }
    }
  }
}
```

Restart Claude Code.

## Step 6: Test It!

In Claude Code, try:

**Send an SMS:**
```
Can you send an SMS to +1234567890 saying "Hello from Twilio MCP!"
```

**Check for incoming messages:**
```
Show me the last 5 inbound SMS messages
```

**View a conversation:**
```
Get the conversation thread for ID: <conversation-id>
```

## What You Can Do

### Send SMS Messages
- Send text messages to any phone number
- Automatic conversation threading
- Track delivery status

### Receive SMS Messages
- Incoming messages automatically stored
- Query by sender, date, conversation
- Full message history

### Manage Conversations
- Create conversation threads
- View full message history
- Track participants and metadata
- AI-powered context summaries

## Next Steps

- Read [README.md](README.md) for full documentation
- See [TESTING.md](TESTING.md) for comprehensive testing guide
- Check example use cases below

## Example Use Cases

### Customer Support Bot
```
Create a conversation with customer +1234567890
Send them: "Hi! How can I help you today?"
Check for their reply
Continue the conversation with context
```

### SMS Notifications
```
Send SMS to +1234567890: "Your order #12345 has shipped!"
Check delivery status
```

### Conversation Analysis
```
Get conversation thread for ID: xxx
Show me the conversation summary with AI context
```

## Troubleshooting

**MCP tools not showing?**
- Restart Claude Code
- Check configuration file path
- Verify build succeeded (`ls dist/`)

**Can't send SMS?**
- Verify Twilio credentials
- Check account balance
- Ensure phone number is in E.164 format (+1234567890)

**Webhooks not working?**
- Verify ngrok is running
- Check `WEBHOOK_BASE_URL` matches ngrok URL
- Verify Twilio webhook configuration
- Check webhook server logs

**Need help?**
- Check logs in terminal running `npm run dev`
- Review [TESTING.md](TESTING.md) for detailed tests
- Verify `.env` configuration

## Architecture Overview

```
┌─────────────────┐
│  Claude Code    │
│   (MCP Client)  │
└────────┬────────┘
         │
         │ MCP Protocol (stdio)
         │
┌────────▼────────┐
│  Twilio MCP     │
│     Server      │
│  ├─ send_sms   │
│  ├─ get_msgs   │
│  └─ manage     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼──┐  ┌──▼────┐
│Twilio│  │SQLite │
│ API  │  │  DB   │
└──────┘  └───────┘
```

Enjoy using Twilio MCP! 🚀
