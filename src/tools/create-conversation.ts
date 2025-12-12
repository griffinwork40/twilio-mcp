/**
 * create_conversation MCP tool
 * Initialize a new conversation thread
 */

import { z } from 'zod';
import { conversationStore } from '../storage/conversation-store.js';

export const createConversationSchema = z.object({
  participants: z.array(z.string().regex(/^\+[1-9]\d{1,14}$/)).min(2),
  metadata: z.record(z.any()).optional(),
});

export type CreateConversationParams = z.infer<typeof createConversationSchema>;

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
