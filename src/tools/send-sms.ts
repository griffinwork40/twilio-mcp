/**
 * send_sms MCP tool
 * Sends outbound SMS messages via Twilio
 */

import { z } from 'zod';
import { twilioClient } from '../services/twilio-client.js';
import { conversationStore } from '../storage/conversation-store.js';
import { messageStore } from '../storage/message-store.js';
import { config } from '../config/env.js';

export const sendSmsSchema = z.object({
  to: z.string().regex(
    /^\+[1-9]\d{1,14}$/,
    'Phone number must be in E.164 format (+1234567890)'
  ),
  message: z.string().min(1).max(1600, 'Message must be between 1 and 1600 characters'),
  from: z.string().regex(/^\+[1-9]\d{1,14}$/).optional(),
  conversationId: z.string().uuid().optional(),
});

export type SendSmsParams = z.infer<typeof sendSmsSchema>;

export async function sendSms(params: SendSmsParams) {
  // Validate input
  const validated = sendSmsSchema.parse(params);

  // Find or create conversation
  let conversationId = validated.conversationId;
  if (!conversationId) {
    const from = validated.from || config.TWILIO_PHONE_NUMBER;
    const participants = [from, validated.to];

    let conversation = conversationStore.findByParticipants(participants);
    if (!conversation && config.AUTO_CREATE_CONVERSATIONS) {
      conversation = conversationStore.create(participants);
    }

    if (conversation) {
      conversationId = conversation.id;
    } else {
      throw new Error('No conversation found and auto-creation is disabled');
    }
  }

  // Send SMS via Twilio
  const twilioMessage = await twilioClient.sendSms({
    to: validated.to,
    body: validated.message,
    from: validated.from,
  });

  // Store message in database
  const message = messageStore.create({
    messageSid: twilioMessage.sid,
    conversationId: conversationId,
    direction: 'outbound',
    from: twilioMessage.from || config.TWILIO_PHONE_NUMBER,
    to: twilioMessage.to,
    body: twilioMessage.body,
    status: twilioMessage.status,
  });

  // Update conversation last activity
  conversationStore.updateLastActivity(conversationId);

  return {
    messageSid: message.messageSid,
    status: message.status,
    to: message.to,
    from: message.from,
    conversationId: message.conversationId,
    timestamp: message.timestamp.toISOString(),
  };
}
