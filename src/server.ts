/**
 * MCP server initialization with tool registry
 * Main MCP server that exposes Twilio SMS tools
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { sendSms } from './tools/send-sms.js';
import { getInboundMessages } from './tools/get-inbound-messages.js';
import { createConversation } from './tools/create-conversation.js';
import { getConversationThread } from './tools/get-conversation-thread.js';
import { getMessageStatus } from './tools/get-message-status.js';

export class TwilioMcpServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'twilio-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'send_sms',
          description: 'Send an SMS message via Twilio. Automatically creates or links to a conversation thread.',
          inputSchema: {
            type: 'object',
            properties: {
              to: {
                type: 'string',
                description: 'Recipient phone number in E.164 format (e.g., +1234567890)',
              },
              message: {
                type: 'string',
                description: 'SMS message content (1-1600 characters)',
              },
              from: {
                type: 'string',
                description: 'Optional: Sender phone number (uses default Twilio number if not provided)',
              },
              conversationId: {
                type: 'string',
                description: 'Optional: UUID of existing conversation to link this message to',
              },
            },
            required: ['to', 'message'],
          },
        },
        {
          name: 'get_inbound_messages',
          description: 'Query received SMS/MMS messages from storage with optional filters.',
          inputSchema: {
            type: 'object',
            properties: {
              from: {
                type: 'string',
                description: 'Filter by sender phone number in E.164 format',
              },
              to: {
                type: 'string',
                description: 'Filter by recipient phone number (your Twilio number)',
              },
              conversationId: {
                type: 'string',
                description: 'Filter by conversation UUID',
              },
              since: {
                type: 'string',
                description: 'ISO 8601 timestamp to filter messages after this date',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of messages to return (1-1000, default: 50)',
                default: 50,
              },
            },
          },
        },
        {
          name: 'create_conversation',
          description: 'Initialize a new conversation thread between participants.',
          inputSchema: {
            type: 'object',
            properties: {
              participants: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Array of phone numbers in E.164 format (minimum 2 participants)',
              },
              metadata: {
                type: 'object',
                description: 'Optional: Custom metadata to attach to the conversation',
              },
            },
            required: ['participants'],
          },
        },
        {
          name: 'get_conversation_thread',
          description: 'Retrieve full conversation history with all messages.',
          inputSchema: {
            type: 'object',
            properties: {
              conversationId: {
                type: 'string',
                description: 'UUID of the conversation to retrieve',
              },
              includeContext: {
                type: 'boolean',
                description: 'Include AI context summary (default: false)',
                default: false,
              },
            },
            required: ['conversationId'],
          },
        },
        {
          name: 'get_message_status',
          description: 'Check the delivery status of a sent message.',
          inputSchema: {
            type: 'object',
            properties: {
              messageSid: {
                type: 'string',
                description: 'Twilio message SID (starts with MM or SM)',
              },
            },
            required: ['messageSid'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'send_sms': {
            const result = await sendSms(request.params.arguments as any);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'get_inbound_messages': {
            const result = await getInboundMessages(request.params.arguments as any);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'create_conversation': {
            const result = await createConversation(request.params.arguments as any);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'get_conversation_thread': {
            const result = await getConversationThread(request.params.arguments as any);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'get_message_status': {
            const result = await getMessageStatus(request.params.arguments as any);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Twilio MCP server running on stdio');
  }
}
