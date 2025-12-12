#!/bin/bash

# Test script for Twilio MCP server
# This demonstrates how to test the MCP tools

echo "Twilio MCP Server Test"
echo "====================="
echo ""
echo "Available MCP Tools:"
echo "  1. send_sms - Send an SMS message"
echo "  2. get_inbound_messages - Query received messages"
echo "  3. create_conversation - Start a new conversation thread"
echo "  4. get_conversation_thread - Get full conversation history"
echo "  5. get_message_status - Check message delivery status"
echo ""
echo "To test the MCP server:"
echo "  1. Set up your .env file with Twilio credentials"
echo "  2. Configure the server in Claude Code MCP settings"
echo "  3. Start the webhook server: npm run dev"
echo "  4. Use the tools in Claude Code"
echo ""
echo "Example tool calls:"
echo ""
echo "send_sms:"
echo '{
  "to": "+1234567890",
  "message": "Hello from Twilio MCP!"
}'
echo ""
echo "get_inbound_messages:"
echo '{
  "limit": 10
}'
echo ""
echo "create_conversation:"
echo '{
  "participants": ["+1234567890", "+1987654321"]
}'
