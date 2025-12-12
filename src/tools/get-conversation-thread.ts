/**
 * get_conversation_thread MCP tool
 * Retrieve full conversation history
 */

import { z } from 'zod';
import { conversationStore } from '../storage/conversation-store.js';
import { messageStore } from '../storage/message-store.js';

export const getConversationThreadSchema = z.object({
  conversationId: z.string().uuid(),
  includeContext: z.boolean().default(false),
});

export type GetConversationThreadParams = z.infer<typeof getConversationThreadSchema>;

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
