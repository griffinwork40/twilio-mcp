/**
 * @fileoverview get_message_status MCP tool implementation
 *
 * This module implements the get_message_status MCP tool, which allows
 * AI clients to check the delivery status of sent messages using the
 * Twilio message SID.
 *
 * @module tools/get-message-status
 * @author Twilio MCP Team
 * @license MIT
 */

import { z } from 'zod';
import { twilioClient } from '../services/twilio-client.js';

/**
 * Zod schema for validating get_message_status tool input parameters.
 *
 * @description
 * Validates the message SID parameter:
 * - `messageSid` - Required, must start with "SM" (SMS) or "MM" (MMS)
 *
 * @constant
 * @type {z.ZodObject}
 *
 * @example
 * // SMS message SID
 * getMessageStatusSchema.parse({
 *   messageSid: 'SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
 * });
 *
 * @example
 * // MMS message SID
 * getMessageStatusSchema.parse({
 *   messageSid: 'MMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
 * });
 */
export const getMessageStatusSchema = z.object({
  messageSid: z.string().startsWith('MM', 'Message SID must start with MM or SM').or(
    z.string().startsWith('SM')
  ),
});

/**
 * TypeScript type for get_message_status tool parameters.
 *
 * @typedef {Object} GetMessageStatusParams
 * @property {string} messageSid - Twilio message SID (starts with SM or MM)
 */
export type GetMessageStatusParams = z.infer<typeof getMessageStatusSchema>;

/**
 * Check the delivery status of a sent message.
 *
 * @description
 * This function implements the get_message_status MCP tool. It:
 * 1. Validates input parameters using Zod schema
 * 2. Fetches message details directly from Twilio API
 * 3. Returns status and error information if applicable
 *
 * This tool queries Twilio's API directly to get real-time status,
 * which may be more current than the locally stored status.
 *
 * **Possible Status Values:**
 * - `queued` - Message is queued for sending
 * - `sending` - Message is currently being sent
 * - `sent` - Message has been sent to carrier
 * - `delivered` - Message was delivered to recipient
 * - `undelivered` - Message could not be delivered
 * - `failed` - Message sending failed
 * - `received` - Inbound message was received
 *
 * @param {GetMessageStatusParams} params - Query parameters
 * @param {string} params.messageSid - Twilio message SID to check
 * @returns {Promise<Object>} Result object with message status
 * @returns {string} returns.messageSid - The queried message SID
 * @returns {string} returns.status - Current message status
 * @returns {number} [returns.errorCode] - Twilio error code (if failed/undelivered)
 * @returns {string} [returns.errorMessage] - Error description (if failed/undelivered)
 * @returns {string} returns.timestamp - ISO 8601 timestamp of last update
 * @returns {string} returns.to - Recipient phone number
 * @returns {string} [returns.from] - Sender phone number
 * @throws {z.ZodError} If input validation fails (invalid SID format)
 * @throws {Error} If message not found or Twilio API error
 *
 * @example
 * // Check status of a sent message
 * const result = await getMessageStatus({
 *   messageSid: 'SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
 * });
 * console.log('Status:', result.status);
 *
 * @example
 * // Handle failed message
 * const result = await getMessageStatus({
 *   messageSid: 'SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
 * });
 * if (result.status === 'failed') {
 *   console.error('Error:', result.errorCode, result.errorMessage);
 * }
 *
 * @example
 * // MCP tool response format (successful delivery)
 * // {
 * //   "messageSid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
 * //   "status": "delivered",
 * //   "timestamp": "2025-01-15T10:31:00.000Z",
 * //   "to": "+1234567890",
 * //   "from": "+1987654321"
 * // }
 *
 * @example
 * // MCP tool response format (failed message)
 * // {
 * //   "messageSid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
 * //   "status": "undelivered",
 * //   "errorCode": 30003,
 * //   "errorMessage": "Unreachable destination handset",
 * //   "timestamp": "2025-01-15T10:31:00.000Z",
 * //   "to": "+1234567890",
 * //   "from": "+1987654321"
 * // }
 *
 * @see {@link https://www.twilio.com/docs/sms/api/message-resource#message-status-values|Twilio Message Status Values}
 */
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
