/**
 * get_inbound_messages MCP tool
 * Query received SMS/MMS messages from storage
 */

import { z } from 'zod';
import { messageStore } from '../storage/message-store.js';

export const getInboundMessagesSchema = z.object({
  from: z.string().regex(/^\+[1-9]\d{1,14}$/).optional(),
  to: z.string().regex(/^\+[1-9]\d{1,14}$/).optional(),
  conversationId: z.string().uuid().optional(),
  since: z.string().datetime().optional(),
  limit: z.number().min(1).max(1000).default(50),
});

export type GetInboundMessagesParams = z.infer<typeof getInboundMessagesSchema>;

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
