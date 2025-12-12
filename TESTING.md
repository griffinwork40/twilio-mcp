# Testing Guide

This guide explains how to test the Twilio MCP server.

## Prerequisites

1. Twilio account with:
   - Account SID
   - Auth Token
   - Phone number with SMS capabilities

2. Environment variables configured in `.env`

## Testing the MCP Server

### 1. Build and Verify

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Verify build output
ls -la dist/
```

### 2. Configure Claude Code

Add to your Claude Code MCP settings (`~/.claude/config.json` or similar):

```json
{
  "mcpServers": {
    "twilio": {
      "command": "node",
      "args": ["/Users/griffinlong/Projects/atlas_projects/twilio-mcp/dist/index.js"],
      "env": {
        "TWILIO_ACCOUNT_SID": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "TWILIO_AUTH_TOKEN": "your_auth_token",
        "TWILIO_PHONE_NUMBER": "+1234567890",
        "WEBHOOK_PORT": "3000",
        "WEBHOOK_BASE_URL": "https://your-ngrok-url.ngrok.io",
        "DATABASE_PATH": "./data/twilio.db"
      }
    }
  }
}
```

### 3. Start the Webhook Server

In one terminal:

```bash
# Start the webhook server
npm run dev
```

In another terminal:

```bash
# Start ngrok to expose webhook server
ngrok http 3000
```

Copy the ngrok HTTPS URL and update your `.env` file's `WEBHOOK_BASE_URL`.

### 4. Configure Twilio Webhooks

1. Go to [Twilio Console](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
2. Select your phone number
3. Configure webhooks:
   - **Messaging Webhook**: `https://your-ngrok-url.ngrok.io/webhooks/twilio/sms` (POST)
   - **Status Callback**: `https://your-ngrok-url.ngrok.io/webhooks/twilio/status` (POST)

## Test Cases

### Test 1: Send SMS

Use the `send_sms` tool in Claude Code:

```json
{
  "to": "+1234567890",
  "message": "Hello from Twilio MCP! This is a test message."
}
```

**Expected Result:**
- Message sent successfully
- Returns message SID, status, and conversation ID
- Message stored in database

### Test 2: Receive Inbound SMS

1. Send an SMS to your Twilio phone number from your mobile device
2. Check the webhook server logs
3. Use `get_inbound_messages` to verify:

```json
{
  "limit": 10
}
```

**Expected Result:**
- Webhook receives message
- Conversation auto-created
- Message stored in database
- Message appears in query results

### Test 3: Conversation Threading

1. Send an SMS to a number:

```json
{
  "to": "+1234567890",
  "message": "First message"
}
```

2. Note the `conversationId` from the response

3. Send another message to the same number:

```json
{
  "to": "+1234567890",
  "message": "Second message"
}
```

4. Get the conversation thread:

```json
{
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "includeContext": true
}
```

**Expected Result:**
- Both messages use the same conversation ID
- Thread shows messages in order
- Context includes message count and last activity

### Test 4: Create Custom Conversation

```json
{
  "participants": ["+1234567890", "+1987654321"],
  "metadata": {
    "campaign": "test",
    "priority": "high"
  }
}
```

**Expected Result:**
- New conversation created with UUID
- Metadata stored correctly
- Can link messages to this conversation

### Test 5: Message Status Tracking

1. Send a message and note the `messageSid`
2. Wait a few seconds
3. Check status:

```json
{
  "messageSid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

**Expected Result:**
- Status progresses: queued → sending → sent → delivered
- No error codes for successful delivery
- Error details if delivery failed

### Test 6: Query Filtered Messages

```json
{
  "from": "+1234567890",
  "since": "2025-01-15T00:00:00Z",
  "limit": 20
}
```

**Expected Result:**
- Returns only messages from specified number
- Only messages after specified date
- Limited to requested count

## Testing the Webhook Security

### Valid Signature Test

Send a properly signed webhook request from Twilio - should be accepted.

### Invalid Signature Test

Try sending a webhook request without proper signature:

```bash
curl -X POST http://localhost:3000/webhooks/twilio/sms \
  -d "MessageSid=SM123&From=+1234567890&To=+1987654321&Body=Test"
```

**Expected Result:**
- Should return 403 Forbidden
- Should log "Invalid webhook signature"

## Database Verification

Check the SQLite database directly:

```bash
# Install sqlite3 if needed
brew install sqlite3

# Query conversations
sqlite3 ./data/twilio.db "SELECT * FROM conversations;"

# Query messages
sqlite3 ./data/twilio.db "SELECT * FROM messages ORDER BY timestamp DESC LIMIT 10;"

# Check conversation message counts
sqlite3 ./data/twilio.db "
SELECT
  c.id,
  COUNT(m.message_sid) as message_count,
  MAX(m.timestamp) as last_message
FROM conversations c
LEFT JOIN messages m ON c.id = m.conversation_id
GROUP BY c.id;
"
```

## Performance Testing

### Load Test: Multiple Messages

Send 10 messages in rapid succession and verify:
- All messages stored correctly
- Conversation threading works
- No race conditions

### Long Conversation Test

Create a conversation with 100+ messages and verify:
- Thread retrieval is fast
- All messages returned in order
- Pagination works if implemented

## Troubleshooting

### Issue: MCP Tools Not Showing

**Solution:**
- Restart Claude Code
- Check MCP configuration syntax
- Verify file paths in config
- Check that build succeeded

### Issue: SMS Not Sending

**Solution:**
- Verify Twilio credentials in `.env`
- Check phone number format (E.164)
- Verify Twilio account has SMS balance
- Check Twilio console for error logs

### Issue: Webhooks Not Receiving

**Solution:**
- Verify ngrok is running and HTTPS URL is correct
- Update `WEBHOOK_BASE_URL` in `.env`
- Check Twilio webhook configuration
- Verify webhook server is running
- Check ngrok web interface (http://localhost:4040)

### Issue: Database Errors

**Solution:**
- Ensure `data/` directory exists
- Check file permissions
- Verify `DATABASE_PATH` in config
- Delete and recreate database if corrupted

## CI/CD Testing

For automated testing in CI/CD:

1. Use Twilio test credentials
2. Mock webhook endpoints
3. Use in-memory SQLite database
4. Run unit tests: `npm test`

## Success Criteria

All tests pass when:
- ✅ Can send SMS successfully
- ✅ Can receive inbound SMS via webhook
- ✅ Conversations auto-thread correctly
- ✅ Message status updates work
- ✅ Database stores data correctly
- ✅ Webhook signature validation works
- ✅ All MCP tools return expected results
- ✅ Error handling works gracefully
