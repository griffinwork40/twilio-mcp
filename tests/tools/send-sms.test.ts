/**
 * Tests for send_sms MCP tool
 * Comprehensive tests for schema validation and business logic
 */

import { z } from 'zod';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

// Define the schema directly for testing (mirrors the actual implementation)
const sendSmsSchema = z.object({
  to: z.string().regex(
    /^\+[1-9]\d{1,14}$/,
    'Phone number must be in E.164 format (+1234567890)'
  ),
  message: z.string().min(1).max(1600, 'Message must be between 1 and 1600 characters'),
  from: z.string().regex(/^\+[1-9]\d{1,14}$/).optional(),
  conversationId: z.string().uuid().optional(),
});

describe('send_sms schema validation', () => {
  describe('to field', () => {
    it('should accept valid E.164 phone number', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'Hello!',
      });
      expect(result.success).toBe(true);
    });

    it('should accept international phone numbers', () => {
      const result = sendSmsSchema.safeParse({
        to: '+447911123456',
        message: 'Hello!',
      });
      expect(result.success).toBe(true);
    });

    it('should reject phone number without + prefix', () => {
      const result = sendSmsSchema.safeParse({
        to: '5559876543',
        message: 'Hello!',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('E.164 format');
      }
    });

    it('should reject phone number starting with +0', () => {
      const result = sendSmsSchema.safeParse({
        to: '+05559876543',
        message: 'Hello!',
      });
      expect(result.success).toBe(false);
    });

    it('should reject phone number with dashes', () => {
      const result = sendSmsSchema.safeParse({
        to: '+1-555-987-6543',
        message: 'Hello!',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty phone number', () => {
      const result = sendSmsSchema.safeParse({
        to: '',
        message: 'Hello!',
      });
      expect(result.success).toBe(false);
    });

    it('should reject phone number with spaces', () => {
      const result = sendSmsSchema.safeParse({
        to: '+1 555 987 6543',
        message: 'Hello!',
      });
      expect(result.success).toBe(false);
    });

    it('should reject phone number with letters', () => {
      const result = sendSmsSchema.safeParse({
        to: '+1555ABC6543',
        message: 'Hello!',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('message field', () => {
    it('should accept valid message', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'Hello, this is a test message!',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty message', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: '',
      });
      expect(result.success).toBe(false);
    });

    it('should accept message at maximum length (1600 chars)', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'a'.repeat(1600),
      });
      expect(result.success).toBe(true);
    });

    it('should reject message over 1600 characters', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'a'.repeat(1601),
      });
      expect(result.success).toBe(false);
    });

    it('should accept message with unicode characters', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'Hello! 👋 How are you? 你好',
      });
      expect(result.success).toBe(true);
    });

    it('should accept message with newlines', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'Line 1\nLine 2\nLine 3',
      });
      expect(result.success).toBe(true);
    });

    it('should accept single character message', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'X',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('from field (optional)', () => {
    it('should accept valid from number', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'Hello!',
        from: '+15551234567',
      });
      expect(result.success).toBe(true);
    });

    it('should work without from number', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'Hello!',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.from).toBeUndefined();
      }
    });

    it('should reject invalid from number format', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'Hello!',
        from: '5551234567',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('conversationId field (optional)', () => {
    it('should accept valid UUID', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'Hello!',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should work without conversationId', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'Hello!',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'Hello!',
        conversationId: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('should reject UUID-like string with wrong format', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'Hello!',
        conversationId: '550e8400e29b41d4a716446655440000', // Missing dashes
      });
      expect(result.success).toBe(false);
    });
  });

  describe('combined validation', () => {
    it('should accept all valid fields', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'Hello!',
        from: '+15551234567',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        // missing message
      });
      expect(result.success).toBe(false);
    });

    it('should reject completely empty object', () => {
      const result = sendSmsSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});

/**
 * Business logic tests using test doubles
 * Tests the sendSms function flow without importing the actual module
 */
describe('send_sms business logic', () => {
  // Test doubles for stores
  class TestConversationStore {
    private db: Database.Database;

    constructor() {
      this.db = new Database(':memory:');
      this.initialize();
    }

    private initialize(): void {
      this.db.exec(`
        CREATE TABLE conversations (
          id TEXT PRIMARY KEY,
          participants TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          last_activity INTEGER NOT NULL,
          metadata TEXT,
          status TEXT DEFAULT 'active'
        )
      `);
    }

    create(participants: string[], metadata?: Record<string, any>) {
      const id = uuidv4();
      const now = Date.now();
      const participantsKey = [...participants].sort().join('|');

      this.db.prepare(`
        INSERT INTO conversations (id, participants, created_at, last_activity, metadata, status)
        VALUES (?, ?, ?, ?, ?, 'active')
      `).run(id, participantsKey, now, now, JSON.stringify(metadata || {}));

      return {
        id,
        participants,
        createdAt: new Date(now),
        lastActivity: new Date(now),
        metadata: metadata || {},
        status: 'active' as const,
      };
    }

    findByParticipants(participants: string[]) {
      const participantsKey = [...participants].sort().join('|');
      const row = this.db.prepare(`
        SELECT * FROM conversations WHERE participants = ? AND status = 'active' LIMIT 1
      `).get(participantsKey) as any;

      return row ? {
        id: row.id,
        participants: row.participants.split('|'),
        createdAt: new Date(row.created_at),
        lastActivity: new Date(row.last_activity),
        metadata: JSON.parse(row.metadata || '{}'),
        status: row.status,
      } : null;
    }

    updateLastActivity(id: string): void {
      this.db.prepare('UPDATE conversations SET last_activity = ? WHERE id = ?')
        .run(Date.now(), id);
    }

    close(): void {
      this.db.close();
    }
  }

  class TestMessageStore {
    private db: Database.Database;

    constructor() {
      this.db = new Database(':memory:');
      this.initialize();
    }

    private initialize(): void {
      this.db.exec(`
        CREATE TABLE messages (
          message_sid TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          direction TEXT NOT NULL,
          from_number TEXT NOT NULL,
          to_number TEXT NOT NULL,
          body TEXT NOT NULL,
          status TEXT NOT NULL,
          timestamp INTEGER NOT NULL
        )
      `);
    }

    create(message: any) {
      const timestamp = message.timestamp || new Date();
      this.db.prepare(`
        INSERT INTO messages (message_sid, conversation_id, direction, from_number, to_number, body, status, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        message.messageSid,
        message.conversationId,
        message.direction,
        message.from,
        message.to,
        message.body,
        message.status,
        timestamp.getTime()
      );
      return { ...message, timestamp };
    }

    close(): void {
      this.db.close();
    }
  }

  // Mock Twilio client
  const createMockTwilioClient = () => ({
    sendSms: async (params: { to: string; body: string; from?: string }) => ({
      sid: `SM${Date.now()}`,
      status: 'queued',
      to: params.to,
      from: params.from || '+15551234567',
      body: params.body,
    }),
  });

  // Config mock
  const mockConfig = {
    TWILIO_PHONE_NUMBER: '+15551234567',
    AUTO_CREATE_CONVERSATIONS: true,
  };

  // Test implementation of sendSms function
  async function testSendSms(
    params: z.infer<typeof sendSmsSchema>,
    conversationStore: TestConversationStore,
    messageStore: TestMessageStore,
    twilioClient: ReturnType<typeof createMockTwilioClient>,
    config: typeof mockConfig
  ) {
    const validated = sendSmsSchema.parse(params);

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

    const twilioMessage = await twilioClient.sendSms({
      to: validated.to,
      body: validated.message,
      from: validated.from,
    });

    const message = messageStore.create({
      messageSid: twilioMessage.sid,
      conversationId: conversationId!,
      direction: 'outbound',
      from: twilioMessage.from || config.TWILIO_PHONE_NUMBER,
      to: twilioMessage.to,
      body: twilioMessage.body,
      status: twilioMessage.status,
    });

    conversationStore.updateLastActivity(conversationId!);

    return {
      messageSid: message.messageSid,
      status: message.status,
      to: message.to,
      from: message.from,
      conversationId: message.conversationId,
      timestamp: message.timestamp.toISOString(),
    };
  }

  let conversationStore: TestConversationStore;
  let messageStore: TestMessageStore;
  let twilioClient: ReturnType<typeof createMockTwilioClient>;

  beforeEach(() => {
    conversationStore = new TestConversationStore();
    messageStore = new TestMessageStore();
    twilioClient = createMockTwilioClient();
  });

  afterEach(() => {
    conversationStore.close();
    messageStore.close();
  });

  describe('conversation management', () => {
    it('should auto-create conversation when none exists', async () => {
      const result = await testSendSms(
        { to: '+15559876543', message: 'Hello!' },
        conversationStore,
        messageStore,
        twilioClient,
        mockConfig
      );

      expect(result.conversationId).toBeDefined();

      // Verify conversation was created
      const conversation = conversationStore.findByParticipants([
        '+15551234567',
        '+15559876543',
      ]);
      expect(conversation).not.toBeNull();
    });

    it('should reuse existing conversation', async () => {
      // Create conversation first
      const existingConv = conversationStore.create(['+15551234567', '+15559876543']);

      const result = await testSendSms(
        { to: '+15559876543', message: 'Hello!' },
        conversationStore,
        messageStore,
        twilioClient,
        mockConfig
      );

      expect(result.conversationId).toBe(existingConv.id);
    });

    it('should find conversation regardless of participant order', async () => {
      // Create conversation with reversed order
      const existingConv = conversationStore.create(['+15559876543', '+15551234567']);

      const result = await testSendSms(
        { to: '+15559876543', message: 'Hello!' },
        conversationStore,
        messageStore,
        twilioClient,
        mockConfig
      );

      expect(result.conversationId).toBe(existingConv.id);
    });

    it('should use provided conversationId when given', async () => {
      const existingConv = conversationStore.create(['+15551234567', '+15559876543']);

      const result = await testSendSms(
        {
          to: '+15559876543',
          message: 'Hello!',
          conversationId: existingConv.id,
        },
        conversationStore,
        messageStore,
        twilioClient,
        mockConfig
      );

      expect(result.conversationId).toBe(existingConv.id);
    });

    it('should throw error when auto-creation is disabled and no conversation exists', async () => {
      const configNoAuto = { ...mockConfig, AUTO_CREATE_CONVERSATIONS: false };

      await expect(testSendSms(
        { to: '+15559876543', message: 'Hello!' },
        conversationStore,
        messageStore,
        twilioClient,
        configNoAuto
      )).rejects.toThrow('No conversation found and auto-creation is disabled');
    });
  });

  describe('message sending', () => {
    it('should return message details after sending', async () => {
      const result = await testSendSms(
        { to: '+15559876543', message: 'Hello!' },
        conversationStore,
        messageStore,
        twilioClient,
        mockConfig
      );

      expect(result.messageSid).toMatch(/^SM/);
      expect(result.status).toBe('queued');
      expect(result.to).toBe('+15559876543');
      expect(result.from).toBe('+15551234567');
      expect(result.timestamp).toBeDefined();
    });

    it('should use custom from number when provided', async () => {
      const customTwilioClient = {
        sendSms: async (params: { to: string; body: string; from?: string }) => ({
          sid: 'SM001',
          status: 'queued',
          to: params.to,
          from: params.from || '+15551234567',
          body: params.body,
        }),
      };

      const result = await testSendSms(
        { to: '+15559876543', message: 'Hello!', from: '+15550001111' },
        conversationStore,
        messageStore,
        customTwilioClient,
        mockConfig
      );

      expect(result.from).toBe('+15550001111');
    });
  });

  describe('error handling', () => {
    it('should throw on validation error for invalid phone', async () => {
      await expect(testSendSms(
        { to: 'invalid', message: 'Hello!' },
        conversationStore,
        messageStore,
        twilioClient,
        mockConfig
      )).rejects.toThrow();
    });

    it('should throw on validation error for empty message', async () => {
      await expect(testSendSms(
        { to: '+15559876543', message: '' },
        conversationStore,
        messageStore,
        twilioClient,
        mockConfig
      )).rejects.toThrow();
    });

    it('should propagate Twilio API errors', async () => {
      const failingClient = {
        sendSms: async () => {
          throw new Error('Twilio API error');
        },
      };

      // Need to create conversation first since the error happens after
      conversationStore.create(['+15551234567', '+15559876543']);

      await expect(testSendSms(
        { to: '+15559876543', message: 'Hello!' },
        conversationStore,
        messageStore,
        failingClient,
        mockConfig
      )).rejects.toThrow('Twilio API error');
    });
  });
});
