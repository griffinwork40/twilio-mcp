/**
 * Express webhook server for receiving inbound SMS from Twilio
 * Handles incoming messages and status updates
 */

import express from 'express';
import { twilioClient } from './services/twilio-client.js';
import { conversationStore } from './storage/conversation-store.js';
import { messageStore } from './storage/message-store.js';
import { config } from './config/env.js';

const app = express();

// Parse Twilio's URL-encoded payloads
app.use(express.urlencoded({ extended: false }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'twilio-mcp-webhook',
    timestamp: new Date().toISOString(),
  });
});

// Inbound SMS/MMS webhook
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

// Message status callback webhook
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
 * Start the webhook server
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
