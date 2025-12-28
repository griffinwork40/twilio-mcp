/**
 * Tests for TwilioClient service
 * Comprehensive tests with Twilio SDK mocking
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Define mocks at module scope before the mock factory
const mockMessageContext = {
  fetch: jest.fn<() => Promise<any>>(),
};

const mockMessagesList = {
  create: jest.fn<() => Promise<any>>(),
  list: jest.fn<() => Promise<any[]>>(),
};

const mockTwilioClient = {
  messages: Object.assign(
    jest.fn(() => mockMessageContext),
    mockMessagesList
  ),
};

const mockValidateRequest = jest.fn<(authToken: string, signature: string, url: string, params: Record<string, string>) => boolean>();

// Mock the twilio module - jest.mock is hoisted so we use __esModule pattern
jest.mock('twilio', () => {
  return {
    __esModule: true,
    default: Object.assign(
      jest.fn(() => mockTwilioClient),
      { validateRequest: mockValidateRequest }
    ),
  };
});

// Import after mocking
import { TwilioClient } from '../../src/services/twilio-client.js';

describe('TwilioClient', () => {
  let client: TwilioClient;

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-assign the mock to the imported module after clearing
    client = new TwilioClient();
  });

  describe('constructor', () => {
    it('should create a TwilioClient instance', () => {
      expect(client).toBeInstanceOf(TwilioClient);
    });
  });

  describe('sendSms', () => {
    it('should send SMS with required parameters', async () => {
      const mockMessage = {
        sid: 'SM0000000000000000000000000000001',
        status: 'queued',
        to: '+15559876543',
        from: '+15551234567',
        body: 'Test message',
      };
      mockMessagesList.create.mockResolvedValue(mockMessage);

      const result = await client.sendSms({
        to: '+15559876543',
        body: 'Test message',
      });

      expect(mockMessagesList.create).toHaveBeenCalledWith({
        to: '+15559876543',
        from: '+15551234567', // Default from env
        body: 'Test message',
      });
      expect(result).toEqual(mockMessage);
    });

    it('should send SMS with custom from number', async () => {
      const mockMessage = {
        sid: 'SM0000000000000000000000000000001',
        status: 'queued',
        to: '+15559876543',
        from: '+15550001111',
        body: 'Test message',
      };
      mockMessagesList.create.mockResolvedValue(mockMessage);

      const result = await client.sendSms({
        to: '+15559876543',
        body: 'Test message',
        from: '+15550001111',
      });

      expect(mockMessagesList.create).toHaveBeenCalledWith({
        to: '+15559876543',
        from: '+15550001111',
        body: 'Test message',
      });
      expect(result.from).toBe('+15550001111');
    });

    it('should handle Twilio API error', async () => {
      const error = new Error('Twilio API error');
      mockMessagesList.create.mockRejectedValue(error);

      await expect(client.sendSms({
        to: '+15559876543',
        body: 'Test message',
      })).rejects.toThrow('Twilio API error');
    });
  });

  describe('sendMms', () => {
    it('should send MMS with media URLs', async () => {
      const mockMessage = {
        sid: 'MM0000000000000000000000000000001',
        status: 'queued',
        to: '+15559876543',
        from: '+15551234567',
        body: 'Check this out!',
      };
      mockMessagesList.create.mockResolvedValue(mockMessage);

      const result = await client.sendMms({
        to: '+15559876543',
        body: 'Check this out!',
        mediaUrls: ['https://example.com/image.jpg'],
      });

      expect(mockMessagesList.create).toHaveBeenCalledWith({
        to: '+15559876543',
        from: '+15551234567',
        body: 'Check this out!',
        mediaUrl: ['https://example.com/image.jpg'],
      });
      expect(result).toEqual(mockMessage);
    });

    it('should send MMS with multiple media URLs', async () => {
      const mockMessage = {
        sid: 'MM0000000000000000000000000000001',
        status: 'queued',
        to: '+15559876543',
        from: '+15551234567',
        body: 'Multiple images',
      };
      mockMessagesList.create.mockResolvedValue(mockMessage);

      await client.sendMms({
        to: '+15559876543',
        body: 'Multiple images',
        mediaUrls: [
          'https://example.com/image1.jpg',
          'https://example.com/image2.jpg',
        ],
      });

      expect(mockMessagesList.create).toHaveBeenCalledWith({
        to: '+15559876543',
        from: '+15551234567',
        body: 'Multiple images',
        mediaUrl: [
          'https://example.com/image1.jpg',
          'https://example.com/image2.jpg',
        ],
      });
    });

    it('should use custom from number for MMS', async () => {
      mockMessagesList.create.mockResolvedValue({
        sid: 'MM001',
        status: 'queued',
        to: '+15559876543',
        from: '+15550001111',
        body: 'Test',
      });

      await client.sendMms({
        to: '+15559876543',
        body: 'Test',
        mediaUrls: ['https://example.com/image.jpg'],
        from: '+15550001111',
      });

      expect(mockMessagesList.create).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '+15550001111',
        })
      );
    });
  });

  describe('getMessage', () => {
    it('should fetch message by SID', async () => {
      const mockMessage = {
        sid: 'SM0000000000000000000000000000001',
        status: 'delivered',
        to: '+15559876543',
        from: '+15551234567',
        body: 'Test message',
        dateUpdated: new Date('2025-01-15T12:00:00Z'),
        errorCode: null,
        errorMessage: null,
      };
      mockMessageContext.fetch.mockResolvedValue(mockMessage);

      const result = await client.getMessage('SM0000000000000000000000000000001');

      expect(mockTwilioClient.messages).toHaveBeenCalledWith('SM0000000000000000000000000000001');
      expect(mockMessageContext.fetch).toHaveBeenCalled();
      expect(result).toEqual(mockMessage);
    });

    it('should handle message not found', async () => {
      const error = new Error('Message not found');
      mockMessageContext.fetch.mockRejectedValue(error);

      await expect(client.getMessage('SM9999999999999999999999999999999'))
        .rejects.toThrow('Message not found');
    });

    it('should return message with error details', async () => {
      const mockMessage = {
        sid: 'SM0000000000000000000000000000001',
        status: 'failed',
        to: '+15559876543',
        from: '+15551234567',
        body: 'Test message',
        dateUpdated: new Date(),
        errorCode: 30003,
        errorMessage: 'Unreachable destination handset',
      };
      mockMessageContext.fetch.mockResolvedValue(mockMessage);

      const result = await client.getMessage('SM0000000000000000000000000000001');

      expect(result.errorCode).toBe(30003);
      expect(result.errorMessage).toBe('Unreachable destination handset');
    });
  });

  describe('listMessages', () => {
    it('should list messages without filters', async () => {
      const mockMessages = [
        { sid: 'SM001', status: 'delivered', to: '+15559876543', from: '+15551234567', body: 'Message 1' },
        { sid: 'SM002', status: 'delivered', to: '+15559876543', from: '+15551234567', body: 'Message 2' },
      ];
      mockMessagesList.list.mockResolvedValue(mockMessages);

      const result = await client.listMessages();

      expect(mockMessagesList.list).toHaveBeenCalledWith({
        to: undefined,
        from: undefined,
        dateSentAfter: undefined,
        limit: 50,
      });
      expect(result).toHaveLength(2);
    });

    it('should list messages with to filter', async () => {
      mockMessagesList.list.mockResolvedValue([]);

      await client.listMessages({ to: '+15559876543' });

      expect(mockMessagesList.list).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '+15559876543',
        })
      );
    });

    it('should list messages with from filter', async () => {
      mockMessagesList.list.mockResolvedValue([]);

      await client.listMessages({ from: '+15551234567' });

      expect(mockMessagesList.list).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '+15551234567',
        })
      );
    });

    it('should list messages with date filter', async () => {
      const dateSentAfter = new Date('2025-01-01');
      mockMessagesList.list.mockResolvedValue([]);

      await client.listMessages({ dateSentAfter });

      expect(mockMessagesList.list).toHaveBeenCalledWith(
        expect.objectContaining({
          dateSentAfter,
        })
      );
    });

    it('should list messages with custom limit', async () => {
      mockMessagesList.list.mockResolvedValue([]);

      await client.listMessages({ limit: 100 });

      expect(mockMessagesList.list).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 100,
        })
      );
    });

    it('should combine multiple filters', async () => {
      const dateSentAfter = new Date('2025-01-01');
      mockMessagesList.list.mockResolvedValue([]);

      await client.listMessages({
        to: '+15559876543',
        from: '+15551234567',
        dateSentAfter,
        limit: 25,
      });

      expect(mockMessagesList.list).toHaveBeenCalledWith({
        to: '+15559876543',
        from: '+15551234567',
        dateSentAfter,
        limit: 25,
      });
    });
  });

  describe('validateWebhookSignature', () => {
    it('should validate correct signature', () => {
      mockValidateRequest.mockReturnValue(true);

      const result = client.validateWebhookSignature(
        'valid-signature',
        'https://example.com/webhook',
        { MessageSid: 'SM001', Body: 'Test' }
      );

      expect(mockValidateRequest).toHaveBeenCalledWith(
        expect.any(String), // auth token
        'valid-signature',
        'https://example.com/webhook',
        { MessageSid: 'SM001', Body: 'Test' }
      );
      expect(result).toBe(true);
    });

    it('should reject invalid signature', () => {
      mockValidateRequest.mockReturnValue(false);

      const result = client.validateWebhookSignature(
        'invalid-signature',
        'https://example.com/webhook',
        { MessageSid: 'SM001' }
      );

      expect(result).toBe(false);
    });

    it('should handle empty signature', () => {
      mockValidateRequest.mockReturnValue(false);

      const result = client.validateWebhookSignature(
        '',
        'https://example.com/webhook',
        {}
      );

      expect(result).toBe(false);
    });

    it('should validate with various parameter shapes', () => {
      mockValidateRequest.mockReturnValue(true);

      const params = {
        MessageSid: 'SM001',
        From: '+15559876543',
        To: '+15551234567',
        Body: 'Hello',
        NumMedia: '0',
      };

      const result = client.validateWebhookSignature(
        'signature',
        'https://example.com/webhooks/twilio/sms',
        params
      );

      expect(mockValidateRequest).toHaveBeenCalledWith(
        expect.any(String),
        'signature',
        'https://example.com/webhooks/twilio/sms',
        params
      );
      expect(result).toBe(true);
    });
  });
});
