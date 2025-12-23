/**
 * @fileoverview Express webhook server for receiving inbound SMS from Twilio
 *
 * This module implements an Express HTTP server that handles Twilio webhook
 * callbacks for inbound SMS/MMS messages and delivery status updates. It
 * validates webhook signatures for security and stores messages locally.
 *
 * @module webhook-server
 * @author Twilio MCP Team
 * @license MIT
 */

import express from 'express';
import { twilioClient } from './services/twilio-client.js';
import { conversationStore } from './storage/conversation-store.js';
import { messageStore } from './storage/message-store.js';
import { config } from './config/env.js';

/** Express application instance */
const app = express();

// Parse Twilio's URL-encoded payloads
app.use(express.urlencoded({ extended: false }));

/**
 * Health check endpoint.
 *
 * @description
 * Returns service status information for monitoring and load balancer health checks.
 *
 * @route GET /health
 * @returns {Object} JSON object with status, service name, and timestamp
 *
 * @example
 * // Response:
 * // {
 * //   "status": "ok",
 * //   "service": "twilio-mcp-webhook",
 * //   "timestamp": "2025-01-15T10:30:00.000Z"
 * // }
 */
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'twilio-mcp-webhook',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Inbound SMS/MMS webhook handler.
 *
 * @description
 * Receives inbound SMS/MMS messages from Twilio. This endpoint:
 * 1. Validates the Twilio webhook signature for security
 * 2. Extracts message content and media URLs
 * 3. Finds or creates a conversation for the participants
 * 4. Stores the message in the database
 * 5. Updates conversation activity timestamp
 * 6. Returns empty TwiML (no auto-reply)
 *
 * Twilio sends POST requests to this endpoint when messages arrive.
 * The webhook URL must be configured in the Twilio console.
 *
 * @route POST /webhooks/twilio/sms
 * @param {Object} req.body - Twilio webhook payload
 * @param {string} req.body.MessageSid - Twilio message SID
 * @param {string} req.body.From - Sender phone number
 * @param {string} req.body.To - Recipient phone number (your Twilio number)
 * @param {string} req.body.Body - Message content
 * @param {string} req.body.NumMedia - Number of media attachments
 * @param {string} req.body.MediaUrl0..N - Media URLs (for MMS)
 * @returns {string} Empty TwiML response
 *
 * @example
 * // Configure in Twilio Console:
 * // Messaging > Phone Numbers > Your Number > Messaging Configuration
 * // Webhook URL: https://your-domain.com/webhooks/twilio/sms
 * // HTTP Method: POST
 *
 * @see {@link https://www.twilio.com/docs/messaging/guides/webhook-request|Twilio Webhook Request}
 */
app.post('/webhooks/twilio/sms', async (req, res): Promise<void> => {
  try {
    // Validate webhook signature
    const signature = req.headers['x-twilio-signature'] as string;
    const url = `${config.WEBHOOK_BASE_URL}/webhooks/twilio/sms`;

    if (!twilioClient.validateWebhookSignature(signature, url, req.body)) {
      console.error('Invalid webhook signature');
      res.status(403).send('Forbidden');
      return;
    }

    // Parse inbound message
    const {
      MessageSid,
      From,
      To,
      Body,
      NumMedia,
      ...mediaParams
    } = req.body;

    // Extract media URLs if present
    const mediaUrls: string[] = [];
    const numMedia = parseInt(NumMedia || '0');
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = mediaParams[`MediaUrl${i}`];
      if (mediaUrl) {
        mediaUrls.push(mediaUrl);
      }
    }

    // Find or create conversation
    const participants = [From, To];
    let conversation = conversationStore.findByParticipants(participants);

    if (!conversation && config.AUTO_CREATE_CONVERSATIONS) {
      conversation = conversationStore.create(participants, {
        source: 'inbound_sms',
        firstMessage: Body,
      });
      console.error(`Created conversation ${conversation.id} for ${From} -> ${To}`);
    }

    if (!conversation) {
      console.error('No conversation found and auto-creation is disabled');
      res.type('text/xml').send('<Response></Response>');
      return;
    }

    // Store message
    messageStore.create({
      messageSid: MessageSid,
      conversationId: conversation.id,
      direction: 'inbound',
      from: From,
      to: To,
      body: Body || '',
      mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
      status: 'received',
    });

    // Update conversation last activity
    conversationStore.updateLastActivity(conversation.id);

    console.error(`Stored inbound message ${MessageSid} in conversation ${conversation.id}`);

    // Respond with empty TwiML (no auto-reply)
    res.type('text/xml');
    res.send('<Response></Response>');
  } catch (error) {
    console.error('Error processing inbound SMS:', error);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Message status callback webhook handler.
 *
 * @description
 * Receives message status updates from Twilio. This endpoint:
 * 1. Validates the Twilio webhook signature for security
 * 2. Extracts status and error information
 * 3. Updates the message status in the database
 *
 * Twilio sends POST requests to this endpoint when message status changes
 * (queued → sent → delivered, or failed/undelivered with error codes).
 *
 * @route POST /webhooks/twilio/status
 * @param {Object} req.body - Twilio status callback payload
 * @param {string} req.body.MessageSid - Twilio message SID
 * @param {string} req.body.MessageStatus - New status value
 * @param {string} [req.body.ErrorCode] - Error code (for failed messages)
 * @param {string} [req.body.ErrorMessage] - Error description
 * @returns {number} HTTP 200 status
 *
 * @example
 * // Configure in Twilio Console or when sending:
 * // Status Callback URL: https://your-domain.com/webhooks/twilio/status
 *
 * @see {@link https://www.twilio.com/docs/messaging/guides/track-outbound-message-status|Track Outbound Message Status}
 */
app.post('/webhooks/twilio/status', async (req, res): Promise<void> => {
  try {
    // Validate webhook signature
    const signature = req.headers['x-twilio-signature'] as string;
    const url = `${config.WEBHOOK_BASE_URL}/webhooks/twilio/status`;

    if (!twilioClient.validateWebhookSignature(signature, url, req.body)) {
      console.error('Invalid webhook signature');
      res.status(403).send('Forbidden');
      return;
    }

    const {
      MessageSid,
      MessageStatus,
      ErrorCode,
      ErrorMessage,
    } = req.body;

    // Update message status in database
    messageStore.updateStatus(
      MessageSid,
      MessageStatus,
      ErrorCode,
      ErrorMessage
    );

    console.error(`Updated message ${MessageSid} status to ${MessageStatus}`);

    res.sendStatus(200);
  } catch (error) {
    console.error('Error processing status callback:', error);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Start the webhook server.
 *
 * @description
 * Starts the Express HTTP server on the configured port. Logs the
 * webhook endpoint URLs for reference.
 *
 * @returns {void}
 *
 * @example
 * import { startWebhookServer } from './webhook-server.js';
 *
 * // Start the server
 * startWebhookServer();
 * // Output:
 * // Webhook server listening on port 3000
 * // Inbound SMS endpoint: https://example.com/webhooks/twilio/sms
 * // Status callback endpoint: https://example.com/webhooks/twilio/status
 */
export function startWebhookServer(): void {
  const port = config.WEBHOOK_PORT;

  app.listen(port, () => {
    console.error(`Webhook server listening on port ${port}`);
    console.error(`Inbound SMS endpoint: ${config.WEBHOOK_BASE_URL}/webhooks/twilio/sms`);
    console.error(`Status callback endpoint: ${config.WEBHOOK_BASE_URL}/webhooks/twilio/status`);
  });
}

// Start server if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startWebhookServer();
}
