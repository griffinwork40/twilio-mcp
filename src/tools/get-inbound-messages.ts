/**
 * @fileoverview get_inbound_messages MCP tool implementation
 *
 * This module implements the get_inbound_messages MCP tool, which allows
 * AI clients to query received SMS/MMS messages from local storage with
 * various filtering options.
 *
 * @module tools/get-inbound-messages
 * @author Twilio MCP Team
 * @license MIT
 */

import { z } from 'zod';
import { messageStore } from '../storage/message-store.js';

/**
 * Zod schema for validating get_inbound_messages tool input parameters.
 *
 * @description
 * Validates optional filter parameters for querying messages:
 * - `from` - Optional, E.164 format phone number to filter by sender
 * - `to` - Optional, E.164 format phone number to filter by recipient
 * - `conversationId` - Optional, UUID to filter by conversation
 * - `since` - Optional, ISO 8601 datetime to filter messages after
 * - `limit` - Optional, 1-1000, defaults to 50
 *
 * @constant
 * @type {z.ZodObject}
 *
 * @example
 * // Query with no filters (returns last 50 messages)
 * getInboundMessagesSchema.parse({});
 *
 * @example
 * // Query with filters
 * getInboundMessagesSchema.parse({
 *   from: '+1234567890',
 *   since: '2025-01-01T00:00:00Z',
 *   limit: 10,
 * });
 */
export const getInboundMessagesSchema = z.object({
  from: z.string().regex(/^\+[1-9]\d{1,14}$/).optional(),
  to: z.string().regex(/^\+[1-9]\d{1,14}$/).optional(),
  conversationId: z.string().uuid().optional(),
  since: z.string().datetime().optional(),
  limit: z.number().min(1).max(1000).default(50),
});

/**
 * TypeScript type for get_inbound_messages tool parameters.
 *
 * @typedef {Object} GetInboundMessagesParams
 * @property {string} [from] - Filter by sender phone number (E.164 format)
 * @property {string} [to] - Filter by recipient phone number (E.164 format)
 * @property {string} [conversationId] - Filter by conversation UUID
 * @property {string} [since] - ISO 8601 datetime to filter messages after
 * @property {number} [limit=50] - Maximum messages to return (1-1000)
 */
export type GetInboundMessagesParams = z.infer<typeof getInboundMessagesSchema>;

/**
 * Query received SMS/MMS messages from local storage.
 *
 * @description
 * This function implements the get_inbound_messages MCP tool. It:
 * 1. Validates input parameters using Zod schema
 * 2. Queries the message store with optional filters
 * 3. Returns formatted message list with metadata
 *
 * Messages are stored locally when received via the webhook endpoint.
 * This tool queries the local SQLite database, not Twilio's API directly,
 * which provides faster response times and offline access to message history.
 *
 * @param {GetInboundMessagesParams} params - Query parameters
 * @param {string} [params.from] - Filter by sender phone number
 * @param {string} [params.to] - Filter by recipient phone number
 * @param {string} [params.conversationId] - Filter by conversation UUID
 * @param {string} [params.since] - ISO 8601 timestamp for date filtering
 * @param {number} [params.limit=50] - Maximum number of messages to return
 * @returns {Promise<Object>} Result object with messages array
 * @returns {Object[]} returns.messages - Array of message objects
 * @returns {string} returns.messages[].messageSid - Twilio message SID
 * @returns {string} returns.messages[].from - Sender phone number
 * @returns {string} returns.messages[].to - Recipient phone number
 * @returns {string} returns.messages[].body - Message content
 * @returns {string[]} [returns.messages[].mediaUrls] - Media URLs (for MMS)
 * @returns {string} returns.messages[].timestamp - ISO 8601 timestamp
 * @returns {string} returns.messages[].conversationId - Associated conversation UUID
 * @returns {string} returns.messages[].status - Message status
 * @returns {string} returns.messages[].direction - "inbound" or "outbound"
 * @returns {number} returns.totalCount - Number of messages returned
 * @throws {z.ZodError} If input validation fails
 *
 * @example
 * // Get all recent messages
 * const result = await getInboundMessages({});
 * console.log(`Found ${result.totalCount} messages`);
 *
 * @example
 * // Get messages from a specific sender
 * const result = await getInboundMessages({
 *   from: '+1234567890',
 *   limit: 10,
 * });
 *
 * @example
 * // Get messages since a specific date
 * const result = await getInboundMessages({
 *   since: '2025-01-01T00:00:00Z',
 * });
 *
 * @example
 * // MCP tool response format
 * // {
 * //   "messages": [
 * //     {
 * //       "messageSid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
 * //       "from": "+1234567890",
 * //       "to": "+1987654321",
 * //       "body": "Hello!",
 * //       "timestamp": "2025-01-15T10:30:00.000Z",
 * //       "conversationId": "550e8400-e29b-41d4-a716-446655440000",
 * //       "status": "received",
 * //       "direction": "inbound"
 * //     }
 * //   ],
 * //   "totalCount": 1
 * // }
 */
export async function getInboundMessages(params: GetInboundMessagesParams) {
  // Validate input
  const validated = getInboundMessagesSchema.parse(params);

  // Query messages
  const messages = messageStore.query({
    from: validated.from,
    to: validated.to,
    conversationId: validated.conversationId,
    since: validated.since ? new Date(validated.since) : undefined,
    limit: validated.limit,
  });

  return {
    messages: messages.map(msg => ({
      messageSid: msg.messageSid,
      from: msg.from,
      to: msg.to,
      body: msg.body,
      mediaUrls: msg.mediaUrls,
      timestamp: msg.timestamp.toISOString(),
      conversationId: msg.conversationId,
      status: msg.status,
      direction: msg.direction,
    })),
    totalCount: messages.length,
  };
}
