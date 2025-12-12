/**
 * get_message_status MCP tool
 * Check delivery status of sent messages
 */

import { z } from 'zod';
import { twilioClient } from '../services/twilio-client.js';

export const getMessageStatusSchema = z.object({
  messageSid: z.string().startsWith('MM', 'Message SID must start with MM or SM').or(
    z.string().startsWith('SM')
  ),
});

export type GetMessageStatusParams = z.infer<typeof getMessageStatusSchema>;

export async function getMessageStatus(params: GetMessageStatusParams) {
  // Validate input
  const validated = getMessageStatusSchema.parse(params);

  // Fetch message from Twilio
  const message = await twilioClient.getMessage(validated.messageSid);

  return {
    messageSid: message.sid,
    status: message.status,
    errorCode: message.errorCode || undefined,
    errorMessage: message.errorMessage || undefined,
    timestamp: message.dateUpdated?.toISOString() || new Date().toISOString(),
    to: message.to,
    from: message.from || undefined,
  };
}
