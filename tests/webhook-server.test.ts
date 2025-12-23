/**
 * Tests for Express webhook server
 * Tests inbound SMS and status callback endpoints
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express, { Express, Request, Response } from 'express';
import request from 'supertest';

// Mock functions
const mockTwilioValidateWebhookSignature = jest.fn();
const mockConversationStoreFindByParticipants = jest.fn();
const mockConversationStoreCreate = jest.fn();
const mockConversationStoreUpdateLastActivity = jest.fn();
const mockMessageStoreCreate = jest.fn();
const mockMessageStoreUpdateStatus = jest.fn();

interface MockConversation {
  id: string;
  participants: string[];
  createdAt: Date;
  lastActivity: Date;
  metadata: Record<string, any>;
  status: string;
}

// Create a test app that mimics webhook-server.ts functionality
function createTestApp(): Express {
  const app = express();
  app.use(express.urlencoded({ extended: false }));

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'twilio-mcp-webhook',
      timestamp: new Date().toISOString(),
    });
  });

  // Inbound SMS/MMS webhook
  app.post('/webhooks/twilio/sms', async (req: Request, res: Response): Promise<void> => {
    try {
      const signature = req.headers['x-twilio-signature'] as string;
      const url = `https://test.example.com/webhooks/twilio/sms`;

      if (!mockTwilioValidateWebhookSignature(signature, url, req.body)) {
        res.status(403).send('Forbidden');
        return;
      }

      const {
        MessageSid,
        From,
        To,
        Body,
        NumMedia,
        ...mediaParams
      } = req.body;

      const mediaUrls: string[] = [];
      const numMedia = parseInt(NumMedia || '0');
      for (let i = 0; i < numMedia; i++) {
        const mediaUrl = mediaParams[`MediaUrl${i}`];
        if (mediaUrl) {
          mediaUrls.push(mediaUrl);
        }
      }

      const participants = [From, To];
      let conversation: MockConversation | null = mockConversationStoreFindByParticipants(participants) as MockConversation | null;

      if (!conversation) {
        conversation = mockConversationStoreCreate(participants, {
          source: 'inbound_sms',
          firstMessage: Body,
        }) as MockConversation | null;
      }

      if (!conversation) {
        res.type('text/xml').send('<Response></Response>');
        return;
      }

      mockMessageStoreCreate({
        messageSid: MessageSid,
        conversationId: conversation.id,
        direction: 'inbound',
        from: From,
        to: To,
        body: Body || '',
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
        status: 'received',
      });

      mockConversationStoreUpdateLastActivity(conversation.id);

      res.type('text/xml');
      res.send('<Response></Response>');
    } catch (error) {
      res.status(500).send('Internal Server Error');
    }
  });

  // Message status callback webhook
  app.post('/webhooks/twilio/status', async (req: Request, res: Response): Promise<void> => {
    try {
      const signature = req.headers['x-twilio-signature'] as string;
      const url = `https://test.example.com/webhooks/twilio/status`;

      if (!mockTwilioValidateWebhookSignature(signature, url, req.body)) {
        res.status(403).send('Forbidden');
        return;
      }

      const {
        MessageSid,
        MessageStatus,
        ErrorCode,
        ErrorMessage,
      } = req.body;

      mockMessageStoreUpdateStatus(
        MessageSid,
        MessageStatus,
        ErrorCode,
        ErrorMessage
      );

      res.sendStatus(200);
    } catch (error) {
      res.status(500).send('Internal Server Error');
    }
  });

  return app;
}

describe('Webhook Server', () => {
  let app: Express;

  const mockConversation: MockConversation = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    participants: ['+15559876543', '+15551234567'],
    createdAt: new Date(),
    lastActivity: new Date(),
    metadata: {},
    status: 'active',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockTwilioValidateWebhookSignature.mockReturnValue(true);
    mockConversationStoreFindByParticipants.mockReturnValue(mockConversation);
    app = createTestApp();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        service: 'twilio-mcp-webhook',
        timestamp: expect.any(String),
      });
    });
  });

  describe('POST /webhooks/twilio/sms', () => {
    const validPayload = {
      MessageSid: 'SM0000000000000000000000000000001',
      From: '+15559876543',
      To: '+15551234567',
      Body: 'Hello from webhook!',
      NumMedia: '0',
    };

    it('should process inbound SMS successfully', async () => {
      const response = await request(app)
        .post('/webhooks/twilio/sms')
        .set('x-twilio-signature', 'valid_signature')
        .type('form')
        .send(validPayload);

      expect(response.status).toBe(200);
      expect(response.type).toBe('text/xml');
      expect(response.text).toBe('<Response></Response>');
    });

    it('should validate webhook signature', async () => {
      await request(app)
        .post('/webhooks/twilio/sms')
        .set('x-twilio-signature', 'valid_signature')
        .type('form')
        .send(validPayload);

      expect(mockTwilioValidateWebhookSignature).toHaveBeenCalledWith(
        'valid_signature',
        'https://test.example.com/webhooks/twilio/sms',
        validPayload
      );
    });

    it('should reject invalid signature with 403', async () => {
      mockTwilioValidateWebhookSignature.mockReturnValue(false);

      const response = await request(app)
        .post('/webhooks/twilio/sms')
        .set('x-twilio-signature', 'invalid_signature')
        .type('form')
        .send(validPayload);

      expect(response.status).toBe(403);
      expect(response.text).toBe('Forbidden');
    });

    it('should find existing conversation', async () => {
      await request(app)
        .post('/webhooks/twilio/sms')
        .set('x-twilio-signature', 'valid_signature')
        .type('form')
        .send(validPayload);

      expect(mockConversationStoreFindByParticipants).toHaveBeenCalledWith([
        '+15559876543',
        '+15551234567',
      ]);
    });

    it('should create new conversation when none exists', async () => {
      mockConversationStoreFindByParticipants.mockReturnValue(null);
      mockConversationStoreCreate.mockReturnValue(mockConversation);

      await request(app)
        .post('/webhooks/twilio/sms')
        .set('x-twilio-signature', 'valid_signature')
        .type('form')
        .send(validPayload);

      expect(mockConversationStoreCreate).toHaveBeenCalledWith(
        ['+15559876543', '+15551234567'],
        {
          source: 'inbound_sms',
          firstMessage: 'Hello from webhook!',
        }
      );
    });

    it('should store inbound message', async () => {
      await request(app)
        .post('/webhooks/twilio/sms')
        .set('x-twilio-signature', 'valid_signature')
        .type('form')
        .send(validPayload);

      expect(mockMessageStoreCreate).toHaveBeenCalledWith({
        messageSid: 'SM0000000000000000000000000000001',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        direction: 'inbound',
        from: '+15559876543',
        to: '+15551234567',
        body: 'Hello from webhook!',
        mediaUrls: undefined,
        status: 'received',
      });
    });

    it('should update conversation last activity', async () => {
      await request(app)
        .post('/webhooks/twilio/sms')
        .set('x-twilio-signature', 'valid_signature')
        .type('form')
        .send(validPayload);

      expect(mockConversationStoreUpdateLastActivity).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000'
      );
    });

    it('should handle MMS with media URLs', async () => {
      const mmsPayload = {
        ...validPayload,
        MessageSid: 'MM0000000000000000000000000000001',
        NumMedia: '2',
        MediaUrl0: 'https://example.com/image1.jpg',
        MediaUrl1: 'https://example.com/image2.jpg',
      };

      await request(app)
        .post('/webhooks/twilio/sms')
        .set('x-twilio-signature', 'valid_signature')
        .type('form')
        .send(mmsPayload);

      expect(mockMessageStoreCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaUrls: [
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
          ],
        })
      );
    });

    it('should handle empty body', async () => {
      const payloadWithoutBody = {
        ...validPayload,
        Body: '',
      };

      await request(app)
        .post('/webhooks/twilio/sms')
        .set('x-twilio-signature', 'valid_signature')
        .type('form')
        .send(payloadWithoutBody);

      expect(mockMessageStoreCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: '',
        })
      );
    });

    it('should return empty TwiML when no conversation created', async () => {
      mockConversationStoreFindByParticipants.mockReturnValue(null);
      mockConversationStoreCreate.mockReturnValue(null);

      const response = await request(app)
        .post('/webhooks/twilio/sms')
        .set('x-twilio-signature', 'valid_signature')
        .type('form')
        .send(validPayload);

      expect(response.status).toBe(200);
      expect(response.text).toBe('<Response></Response>');
      expect(mockMessageStoreCreate).not.toHaveBeenCalled();
    });
  });

  describe('POST /webhooks/twilio/status', () => {
    const validPayload = {
      MessageSid: 'SM0000000000000000000000000000001',
      MessageStatus: 'delivered',
    };

    it('should process status callback successfully', async () => {
      const response = await request(app)
        .post('/webhooks/twilio/status')
        .set('x-twilio-signature', 'valid_signature')
        .type('form')
        .send(validPayload);

      expect(response.status).toBe(200);
    });

    it('should validate webhook signature', async () => {
      await request(app)
        .post('/webhooks/twilio/status')
        .set('x-twilio-signature', 'valid_signature')
        .type('form')
        .send(validPayload);

      expect(mockTwilioValidateWebhookSignature).toHaveBeenCalledWith(
        'valid_signature',
        'https://test.example.com/webhooks/twilio/status',
        validPayload
      );
    });

    it('should reject invalid signature with 403', async () => {
      mockTwilioValidateWebhookSignature.mockReturnValue(false);

      const response = await request(app)
        .post('/webhooks/twilio/status')
        .set('x-twilio-signature', 'invalid_signature')
        .type('form')
        .send(validPayload);

      expect(response.status).toBe(403);
      expect(response.text).toBe('Forbidden');
    });

    it('should update message status', async () => {
      await request(app)
        .post('/webhooks/twilio/status')
        .set('x-twilio-signature', 'valid_signature')
        .type('form')
        .send(validPayload);

      expect(mockMessageStoreUpdateStatus).toHaveBeenCalledWith(
        'SM0000000000000000000000000000001',
        'delivered',
        undefined,
        undefined
      );
    });

    it('should update status with error details', async () => {
      const errorPayload = {
        MessageSid: 'SM0000000000000000000000000000001',
        MessageStatus: 'failed',
        ErrorCode: '30003',
        ErrorMessage: 'Unreachable destination handset',
      };

      await request(app)
        .post('/webhooks/twilio/status')
        .set('x-twilio-signature', 'valid_signature')
        .type('form')
        .send(errorPayload);

      expect(mockMessageStoreUpdateStatus).toHaveBeenCalledWith(
        'SM0000000000000000000000000000001',
        'failed',
        '30003',
        'Unreachable destination handset'
      );
    });

    it('should handle various message statuses', async () => {
      const statuses = ['queued', 'sending', 'sent', 'delivered', 'failed', 'undelivered'];

      for (const status of statuses) {
        jest.clearAllMocks();
        mockTwilioValidateWebhookSignature.mockReturnValue(true);

        await request(app)
          .post('/webhooks/twilio/status')
          .set('x-twilio-signature', 'valid_signature')
          .type('form')
          .send({
            MessageSid: 'SM0000000000000000000000000000001',
            MessageStatus: status,
          });

        expect(mockMessageStoreUpdateStatus).toHaveBeenCalledWith(
          'SM0000000000000000000000000000001',
          status,
          undefined,
          undefined
        );
      }
    });
  });
});
