/**
 * @fileoverview Twilio client service wrapper
 *
 * This module provides an abstraction layer for Twilio SDK operations,
 * encapsulating all direct Twilio API interactions. It handles SMS/MMS
 * sending, message retrieval, and webhook signature validation.
 *
 * @module services/twilio-client
 * @author Twilio MCP Team
 * @license MIT
 */

import twilio from 'twilio';
import type { MessageInstance, MessageListInstanceCreateOptions } from 'twilio/lib/rest/api/v2010/account/message.js';
import { config } from '../config/env.js';

/**
 * TwilioClient provides a wrapper around the Twilio SDK for SMS operations.
 *
 * @description
 * This class encapsulates all Twilio API interactions, providing methods for:
 * - Sending SMS messages
 * - Sending MMS messages with media attachments
 * - Retrieving message details by SID
 * - Listing messages with filters
 * - Validating webhook signatures for security
 *
 * The client uses environment configuration for authentication and
 * provides a default "from" number for outbound messages.
 *
 * @example
 * // Using the singleton instance
 * import { twilioClient } from './services/twilio-client.js';
 *
 * // Send an SMS
 * const message = await twilioClient.sendSms({
 *   to: '+1234567890',
 *   body: 'Hello from Twilio!',
 * });
 * console.log('Message SID:', message.sid);
 *
 * @example
 * // Validate webhook signature
 * const isValid = twilioClient.validateWebhookSignature(
 *   signature,
 *   'https://example.com/webhook',
 *   req.body
 * );
 */
export class TwilioClient {
  /** @private Twilio SDK client instance */
  private client: twilio.Twilio;

  /** @private Default sender phone number from configuration */
  private defaultFrom: string;

  /**
   * Creates a new TwilioClient instance.
   *
   * @description
   * Initializes the Twilio SDK with credentials from environment configuration.
   * The client is authenticated using TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.
   *
   * @throws {Error} If environment configuration is invalid (thrown by config module)
   */
  constructor() {
    this.client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
    this.defaultFrom = config.TWILIO_PHONE_NUMBER;
  }

  /**
   * Send an SMS message via Twilio.
   *
   * @description
   * Sends a text message to the specified recipient. If no "from" number
   * is provided, uses the default Twilio phone number from configuration.
   *
   * @param {Object} params - SMS parameters
   * @param {string} params.to - Recipient phone number in E.164 format (e.g., +1234567890)
   * @param {string} params.body - Message content (1-1600 characters)
   * @param {string} [params.from] - Sender phone number (optional, uses default if not provided)
   * @returns {Promise<MessageInstance>} Twilio message instance with SID, status, etc.
   * @throws {Error} If the Twilio API returns an error (invalid number, rate limit, etc.)
   *
   * @example
   * const message = await twilioClient.sendSms({
   *   to: '+1234567890',
   *   body: 'Your verification code is 123456',
   * });
   * console.log('Sent message:', message.sid);
   *
   * @example
   * // With custom sender number
   * const message = await twilioClient.sendSms({
   *   to: '+1234567890',
   *   body: 'Hello!',
   *   from: '+1987654321',
   * });
   */
  async sendSms(params: {
    to: string;
    body: string;
    from?: string;
  }): Promise<MessageInstance> {
    const createOptions: MessageListInstanceCreateOptions = {
      to: params.to,
      from: params.from || this.defaultFrom,
      body: params.body,
    };

    return await this.client.messages.create(createOptions);
  }

  /**
   * Send an MMS message with media attachments via Twilio.
   *
   * @description
   * Sends a multimedia message with one or more media attachments.
   * Requires MMS to be enabled in environment configuration (ENABLE_MMS=true).
   *
   * @param {Object} params - MMS parameters
   * @param {string} params.to - Recipient phone number in E.164 format
   * @param {string} params.body - Message content
   * @param {string[]} params.mediaUrls - Array of publicly accessible media URLs
   * @param {string} [params.from] - Sender phone number (optional)
   * @returns {Promise<MessageInstance>} Twilio message instance
   * @throws {Error} If MMS is not enabled (ENABLE_MMS=false)
   * @throws {Error} If the Twilio API returns an error
   *
   * @example
   * const message = await twilioClient.sendMms({
   *   to: '+1234567890',
   *   body: 'Check out this photo!',
   *   mediaUrls: ['https://example.com/image.jpg'],
   * });
   */
  async sendMms(params: {
    to: string;
    body: string;
    mediaUrls: string[];
    from?: string;
  }): Promise<MessageInstance> {
    if (!config.ENABLE_MMS) {
      throw new Error('MMS is not enabled. Set ENABLE_MMS=true in environment.');
    }

    const createOptions: MessageListInstanceCreateOptions = {
      to: params.to,
      from: params.from || this.defaultFrom,
      body: params.body,
      mediaUrl: params.mediaUrls,
    };

    return await this.client.messages.create(createOptions);
  }

  /**
   * Get a message by its SID from Twilio.
   *
   * @description
   * Retrieves the full message details from Twilio's API using the message SID.
   * Useful for checking delivery status, error codes, and other message metadata.
   *
   * @param {string} messageSid - Twilio message SID (starts with SM or MM)
   * @returns {Promise<MessageInstance>} Full message details including status
   * @throws {Error} If the message is not found or API returns an error
   *
   * @example
   * const message = await twilioClient.getMessage('SM1234567890abcdef');
   * console.log('Status:', message.status);
   * console.log('Error code:', message.errorCode);
   */
  async getMessage(messageSid: string): Promise<MessageInstance> {
    return await this.client.messages(messageSid).fetch();
  }

  /**
   * List messages with optional filters.
   *
   * @description
   * Retrieves a list of messages from Twilio with optional filtering by
   * sender, recipient, and date. Results are limited to the specified count.
   *
   * @param {Object} [params] - Optional filter parameters
   * @param {string} [params.to] - Filter by recipient phone number
   * @param {string} [params.from] - Filter by sender phone number
   * @param {Date} [params.dateSentAfter] - Filter messages sent after this date
   * @param {number} [params.limit=50] - Maximum number of messages to return
   * @returns {Promise<MessageInstance[]>} Array of message instances
   * @throws {Error} If the Twilio API returns an error
   *
   * @example
   * // Get recent messages from a specific sender
   * const messages = await twilioClient.listMessages({
   *   from: '+1234567890',
   *   limit: 10,
   * });
   *
   * @example
   * // Get messages sent in the last 24 hours
   * const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
   * const messages = await twilioClient.listMessages({
   *   dateSentAfter: yesterday,
   * });
   */
  async listMessages(params?: {
    to?: string;
    from?: string;
    dateSentAfter?: Date;
    limit?: number;
  }): Promise<MessageInstance[]> {
    const messages = await this.client.messages.list({
      to: params?.to,
      from: params?.from,
      dateSentAfter: params?.dateSentAfter,
      limit: params?.limit || 50,
    });

    return messages;
  }

  /**
   * Validate webhook signature for security.
   *
   * @description
   * Verifies that an incoming webhook request is actually from Twilio by
   * validating the X-Twilio-Signature header. This prevents spoofed requests.
   *
   * @param {string} signature - X-Twilio-Signature header value from the request
   * @param {string} url - Full URL of the webhook endpoint (must match Twilio config exactly)
   * @param {Record<string, string>} params - Request body parameters
   * @returns {boolean} True if signature is valid, false otherwise
   *
   * @example
   * // In Express middleware
   * const signature = req.headers['x-twilio-signature'] as string;
   * const url = 'https://example.com/webhooks/twilio/sms';
   *
   * if (!twilioClient.validateWebhookSignature(signature, url, req.body)) {
   *   res.status(403).send('Forbidden');
   *   return;
   * }
   *
   * @see {@link https://www.twilio.com/docs/usage/security#validating-requests|Twilio Request Validation}
   */
  validateWebhookSignature(
    signature: string,
    url: string,
    params: Record<string, string>
  ): boolean {
    return twilio.validateRequest(
      config.TWILIO_AUTH_TOKEN,
      signature,
      url,
      params
    );
  }
}

/**
 * Singleton instance of TwilioClient for use throughout the application.
 *
 * @description
 * Pre-initialized TwilioClient instance that should be used for all
 * Twilio operations. Using a singleton ensures consistent authentication
 * and configuration across the application.
 *
 * @constant
 * @type {TwilioClient}
 *
 * @example
 * import { twilioClient } from './services/twilio-client.js';
 *
 * // Use the singleton for all operations
 * await twilioClient.sendSms({ to: '+1234567890', body: 'Hello!' });
 */
export const twilioClient = new TwilioClient();
