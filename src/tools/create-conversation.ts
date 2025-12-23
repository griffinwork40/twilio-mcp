/**
 * @fileoverview create_conversation MCP tool implementation
 *
 * This module implements the create_conversation MCP tool, which allows
 * AI clients to initialize new conversation threads between participants.
 * Conversations are used to group related messages together.
 *
 * @module tools/create-conversation
 * @author Twilio MCP Team
 * @license MIT
 */

import { z } from 'zod';
import { conversationStore } from '../storage/conversation-store.js';

/**
 * Zod schema for validating create_conversation tool input parameters.
 *
 * @description
 * Validates input parameters for creating a conversation:
 * - `participants` - Required, array of 2+ E.164 format phone numbers
 * - `metadata` - Optional, arbitrary key-value pairs for custom data
 *
 * @constant
 * @type {z.ZodObject}
 *
 * @example
 * // Minimum valid input
 * createConversationSchema.parse({
 *   participants: ['+1234567890', '+1987654321'],
 * });
 *
 * @example
 * // With metadata
 * createConversationSchema.parse({
 *   participants: ['+1234567890', '+1987654321'],
 *   metadata: { campaign: 'support', priority: 'high' },
 * });
 */
export const createConversationSchema = z.object({
  participants: z.array(z.string().regex(/^\+[1-9]\d{1,14}$/)).min(2),
  metadata: z.record(z.any()).optional(),
});

/**
 * TypeScript type for create_conversation tool parameters.
 *
 * @typedef {Object} CreateConversationParams
 * @property {string[]} participants - Array of phone numbers in E.164 format (min 2)
 * @property {Record<string, any>} [metadata] - Optional custom metadata
 */
export type CreateConversationParams = z.infer<typeof createConversationSchema>;

/**
 * Initialize a new conversation thread between participants.
 *
 * @description
 * This function implements the create_conversation MCP tool. It:
 * 1. Validates input parameters using Zod schema
 * 2. Creates a new conversation in the database
 * 3. Returns the conversation details with generated UUID
 *
 * Conversations are identified by their participant set (normalized and sorted).
 * This means a conversation between [+A, +B] is the same as [+B, +A].
 * Note: This function always creates a new conversation; use findByParticipants
 * to check for existing conversations first if needed.
 *
 * @param {CreateConversationParams} params - Conversation parameters
 * @param {string[]} params.participants - Array of phone numbers (minimum 2 required)
 * @param {Record<string, any>} [params.metadata] - Optional custom metadata to store
 * @returns {Promise<Object>} Result object with conversation details
 * @returns {string} returns.conversationId - Generated UUID for the conversation
 * @returns {string[]} returns.participants - Array of participant phone numbers
 * @returns {string} returns.createdAt - ISO 8601 timestamp of creation
 * @returns {Record<string, any>} returns.metadata - Stored metadata (empty object if none)
 * @throws {z.ZodError} If input validation fails (invalid phone numbers, <2 participants)
 *
 * @example
 * // Create a basic conversation
 * const result = await createConversation({
 *   participants: ['+1234567890', '+1987654321'],
 * });
 * console.log('Conversation ID:', result.conversationId);
 *
 * @example
 * // Create with metadata for tracking
 * const result = await createConversation({
 *   participants: ['+1234567890', '+1987654321', '+1555555555'],
 *   metadata: {
 *     campaign: 'customer-support',
 *     ticketId: 'TICKET-123',
 *     priority: 'high',
 *   },
 * });
 *
 * @example
 * // MCP tool response format
 * // {
 * //   "conversationId": "550e8400-e29b-41d4-a716-446655440000",
 * //   "participants": ["+1234567890", "+1987654321"],
 * //   "createdAt": "2025-01-15T10:30:00.000Z",
 * //   "metadata": {}
 * // }
 */
export async function createConversation(params: CreateConversationParams) {
  // Validate input
  const validated = createConversationSchema.parse(params);

  // Create conversation
  const conversation = conversationStore.create(
    validated.participants,
    validated.metadata
  );

  return {
    conversationId: conversation.id,
    participants: conversation.participants,
    createdAt: conversation.createdAt.toISOString(),
    metadata: conversation.metadata,
  };
}
