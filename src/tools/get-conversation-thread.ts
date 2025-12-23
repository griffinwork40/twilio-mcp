/**
 * @fileoverview get_conversation_thread MCP tool implementation
 *
 * This module implements the get_conversation_thread MCP tool, which allows
 * AI clients to retrieve the full history of a conversation including all
 * messages and optional context information.
 *
 * @module tools/get-conversation-thread
 * @author Twilio MCP Team
 * @license MIT
 */

import { z } from 'zod';
import { conversationStore } from '../storage/conversation-store.js';
import { messageStore } from '../storage/message-store.js';

/**
 * Zod schema for validating get_conversation_thread tool input parameters.
 *
 * @description
 * Validates input parameters for retrieving a conversation:
 * - `conversationId` - Required, valid UUID of the conversation
 * - `includeContext` - Optional boolean, defaults to false
 *
 * @constant
 * @type {z.ZodObject}
 *
 * @example
 * // Basic usage
 * getConversationThreadSchema.parse({
 *   conversationId: '550e8400-e29b-41d4-a716-446655440000',
 * });
 *
 * @example
 * // With context
 * getConversationThreadSchema.parse({
 *   conversationId: '550e8400-e29b-41d4-a716-446655440000',
 *   includeContext: true,
 * });
 */
export const getConversationThreadSchema = z.object({
  conversationId: z.string().uuid(),
  includeContext: z.boolean().default(false),
});

/**
 * TypeScript type for get_conversation_thread tool parameters.
 *
 * @typedef {Object} GetConversationThreadParams
 * @property {string} conversationId - UUID of the conversation to retrieve
 * @property {boolean} [includeContext=false] - Whether to include AI context summary
 */
export type GetConversationThreadParams = z.infer<typeof getConversationThreadSchema>;

/**
 * Retrieve full conversation history with all messages.
 *
 * @description
 * This function implements the get_conversation_thread MCP tool. It:
 * 1. Validates input parameters using Zod schema
 * 2. Retrieves the conversation from storage
 * 3. Fetches all messages associated with the conversation
 * 4. Optionally includes context summary information
 *
 * Messages are returned in chronological order (oldest first).
 * The context summary provides metadata useful for AI to understand
 * the conversation state without reading all messages.
 *
 * @param {GetConversationThreadParams} params - Query parameters
 * @param {string} params.conversationId - UUID of the conversation to retrieve
 * @param {boolean} [params.includeContext=false] - Include AI context summary
 * @returns {Promise<Object>} Result object with conversation and messages
 * @returns {string} returns.conversationId - Conversation UUID
 * @returns {string[]} returns.participants - Array of participant phone numbers
 * @returns {Object[]} returns.messages - Array of message objects (chronological)
 * @returns {string} returns.messages[].messageSid - Twilio message SID
 * @returns {string} returns.messages[].direction - "inbound" or "outbound"
 * @returns {string} returns.messages[].from - Sender phone number
 * @returns {string} returns.messages[].to - Recipient phone number
 * @returns {string} returns.messages[].body - Message content
 * @returns {string[]} [returns.messages[].mediaUrls] - Media URLs (for MMS)
 * @returns {string} returns.messages[].timestamp - ISO 8601 timestamp
 * @returns {string} returns.messages[].status - Message status
 * @returns {Object} [returns.context] - Context summary (if includeContext=true)
 * @returns {string} returns.context.summary - Brief description of conversation
 * @returns {string} returns.context.lastActivity - ISO 8601 timestamp of last activity
 * @returns {number} returns.context.messageCount - Total number of messages
 * @throws {z.ZodError} If input validation fails
 * @throws {Error} If conversation is not found
 *
 * @example
 * // Get conversation without context
 * const result = await getConversationThread({
 *   conversationId: '550e8400-e29b-41d4-a716-446655440000',
 * });
 * console.log(`Found ${result.messages.length} messages`);
 *
 * @example
 * // Get conversation with context
 * const result = await getConversationThread({
 *   conversationId: '550e8400-e29b-41d4-a716-446655440000',
 *   includeContext: true,
 * });
 * console.log('Summary:', result.context.summary);
 * console.log('Messages:', result.context.messageCount);
 *
 * @example
 * // MCP tool response format (with context)
 * // {
 * //   "conversationId": "550e8400-e29b-41d4-a716-446655440000",
 * //   "participants": ["+1234567890", "+1987654321"],
 * //   "messages": [
 * //     {
 * //       "messageSid": "SMxxxxxxx",
 * //       "direction": "outbound",
 * //       "from": "+1987654321",
 * //       "to": "+1234567890",
 * //       "body": "Hello!",
 * //       "timestamp": "2025-01-15T10:30:00.000Z",
 * //       "status": "delivered"
 * //     },
 * //     {
 * //       "messageSid": "SMyyyyyyy",
 * //       "direction": "inbound",
 * //       "from": "+1234567890",
 * //       "to": "+1987654321",
 * //       "body": "Hi there!",
 * //       "timestamp": "2025-01-15T10:31:00.000Z",
 * //       "status": "received"
 * //     }
 * //   ],
 * //   "context": {
 * //     "summary": "Conversation with 2 participants",
 * //     "lastActivity": "2025-01-15T10:31:00.000Z",
 * //     "messageCount": 2
 * //   }
 * // }
 */
export async function getConversationThread(params: GetConversationThreadParams) {
  // Validate input
  const validated = getConversationThreadSchema.parse(params);

  // Get conversation
  const conversation = conversationStore.getById(validated.conversationId);
  if (!conversation) {
    throw new Error(`Conversation ${validated.conversationId} not found`);
  }

  // Get all messages
  const messages = messageStore.getByConversation(validated.conversationId);

  const response: any = {
    conversationId: conversation.id,
    participants: conversation.participants,
    messages: messages.map(msg => ({
      messageSid: msg.messageSid,
      direction: msg.direction,
      from: msg.from,
      to: msg.to,
      body: msg.body,
      mediaUrls: msg.mediaUrls,
      timestamp: msg.timestamp.toISOString(),
      status: msg.status,
    })),
  };

  // Include context if requested
  if (validated.includeContext) {
    const messageCount = messages.length;

    response.context = {
      summary: `Conversation with ${conversation.participants.length} participants`,
      lastActivity: conversation.lastActivity.toISOString(),
      messageCount,
    };
  }

  return response;
}
