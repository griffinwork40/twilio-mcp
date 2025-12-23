/**
 * @fileoverview send_sms MCP tool implementation
 *
 * This module implements the send_sms MCP tool, which allows AI clients
 * to send outbound SMS messages via Twilio. Messages are automatically
 * linked to conversation threads for context management.
 *
 * @module tools/send-sms
 * @author Twilio MCP Team
 * @license MIT
 */

import { z } from 'zod';
import { twilioClient } from '../services/twilio-client.js';
import { conversationStore } from '../storage/conversation-store.js';
import { messageStore } from '../storage/message-store.js';
import { config } from '../config/env.js';

/**
 * Zod schema for validating send_sms tool input parameters.
 *
 * @description
 * Validates all input parameters before sending an SMS:
 * - `to` - Required, must be E.164 format phone number
 * - `message` - Required, 1-1600 characters
 * - `from` - Optional, E.164 format phone number
 * - `conversationId` - Optional, valid UUID
 *
 * @constant
 * @type {z.ZodObject}
 *
 * @example
 * // Valid input
 * sendSmsSchema.parse({
 *   to: '+1234567890',
 *   message: 'Hello, world!',
 * });
 *
 * @example
 * // With optional parameters
 * sendSmsSchema.parse({
 *   to: '+1234567890',
 *   message: 'Hello!',
 *   from: '+1987654321',
 *   conversationId: '550e8400-e29b-41d4-a716-446655440000',
 * });
 */
export const sendSmsSchema = z.object({
  to: z.string().regex(
    /^\+[1-9]\d{1,14}$/,
    'Phone number must be in E.164 format (+1234567890)'
  ),
  message: z.string().min(1).max(1600, 'Message must be between 1 and 1600 characters'),
  from: z.string().regex(/^\+[1-9]\d{1,14}$/).optional(),
  conversationId: z.string().uuid().optional(),
});

/**
 * TypeScript type for send_sms tool parameters.
 *
 * @typedef {Object} SendSmsParams
 * @property {string} to - Recipient phone number in E.164 format
 * @property {string} message - SMS message content (1-1600 chars)
 * @property {string} [from] - Optional sender phone number
 * @property {string} [conversationId] - Optional conversation UUID to link to
 */
export type SendSmsParams = z.infer<typeof sendSmsSchema>;

/**
 * Send an SMS message via Twilio with automatic conversation threading.
 *
 * @description
 * This function implements the send_sms MCP tool. It:
 * 1. Validates input parameters using Zod schema
 * 2. Finds or creates a conversation thread for the message
 * 3. Sends the SMS via Twilio API
 * 4. Stores the message in the local database
 * 5. Updates conversation activity timestamp
 *
 * If no conversationId is provided, the function looks for an existing
 * conversation between the participants. If none exists and
 * AUTO_CREATE_CONVERSATIONS is enabled, a new conversation is created.
 *
 * @param {SendSmsParams} params - SMS parameters
 * @param {string} params.to - Recipient phone number in E.164 format (e.g., +1234567890)
 * @param {string} params.message - Message content (1-1600 characters)
 * @param {string} [params.from] - Sender phone number (uses default if not provided)
 * @param {string} [params.conversationId] - UUID of existing conversation to link to
 * @returns {Promise<Object>} Result object with message details
 * @returns {string} returns.messageSid - Twilio message SID
 * @returns {string} returns.status - Message status (queued, sent, delivered, etc.)
 * @returns {string} returns.to - Recipient phone number
 * @returns {string} returns.from - Sender phone number
 * @returns {string} returns.conversationId - Associated conversation UUID
 * @returns {string} returns.timestamp - ISO 8601 timestamp
 * @throws {z.ZodError} If input validation fails
 * @throws {Error} If no conversation found and AUTO_CREATE_CONVERSATIONS is false
 * @throws {Error} If Twilio API returns an error
 *
 * @example
 * // Send a simple SMS
 * const result = await sendSms({
 *   to: '+1234567890',
 *   message: 'Hello from the MCP server!',
 * });
 * console.log('Message SID:', result.messageSid);
 * console.log('Status:', result.status);
 *
 * @example
 * // Send to an existing conversation
 * const result = await sendSms({
 *   to: '+1234567890',
 *   message: 'Following up on our conversation',
 *   conversationId: '550e8400-e29b-41d4-a716-446655440000',
 * });
 *
 * @example
 * // MCP tool response format
 * // {
 * //   "messageSid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
 * //   "status": "queued",
 * //   "to": "+1234567890",
 * //   "from": "+1987654321",
 * //   "conversationId": "550e8400-e29b-41d4-a716-446655440000",
 * //   "timestamp": "2025-01-15T10:30:00.000Z"
 * // }
 */
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
