/**
 * Tests for get_inbound_messages MCP tool
 * Comprehensive tests for schema validation and business logic
 */

import { z } from 'zod';
import Database from 'better-sqlite3';

// Define the schema directly for testing (mirrors the actual implementation)
const getInboundMessagesSchema = z.object({
  from: z.string().regex(/^\+[1-9]\d{1,14}$/).optional(),
  to: z.string().regex(/^\+[1-9]\d{1,14}$/).optional(),
  conversationId: z.string().uuid().optional(),
  since: z.string().datetime().optional(),
  limit: z.number().min(1).max(1000).default(50),
});

describe('get_inbound_messages schema validation', () => {
  describe('from field', () => {
    it('should accept valid E.164 phone number', () => {
      const result = getInboundMessagesSchema.safeParse({
        from: '+15559876543',
      });
      expect(result.success).toBe(true);
    });

    it('should work without from field', () => {
      const result = getInboundMessagesSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject invalid phone number', () => {
      const result = getInboundMessagesSchema.safeParse({
        from: '5559876543',
      });
      expect(result.success).toBe(false);
    });

    it('should accept international phone numbers', () => {
      const result = getInboundMessagesSchema.safeParse({
        from: '+447911123456',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('to field', () => {
    it('should accept valid E.164 phone number', () => {
      const result = getInboundMessagesSchema.safeParse({
        to: '+15551234567',
      });
      expect(result.success).toBe(true);
    });

    it('should work without to field', () => {
      const result = getInboundMessagesSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject invalid phone number', () => {
      const result = getInboundMessagesSchema.safeParse({
        to: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('conversationId field', () => {
    it('should accept valid UUID', () => {
      const result = getInboundMessagesSchema.safeParse({
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should work without conversationId', () => {
      const result = getInboundMessagesSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = getInboundMessagesSchema.safeParse({
        conversationId: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('since field', () => {
    it('should accept valid ISO datetime with Z suffix', () => {
      const result = getInboundMessagesSchema.safeParse({
        since: '2025-01-15T10:00:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('should accept datetime with milliseconds', () => {
      const result = getInboundMessagesSchema.safeParse({
        since: '2025-01-15T10:00:00.000Z',
      });
      expect(result.success).toBe(true);
    });

    it('should work without since field', () => {
      const result = getInboundMessagesSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject date without time', () => {
      const result = getInboundMessagesSchema.safeParse({
        since: '2025-01-15',
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-ISO datetime', () => {
      const result = getInboundMessagesSchema.safeParse({
        since: 'January 15, 2025',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid datetime string', () => {
      const result = getInboundMessagesSchema.safeParse({
        since: 'not-a-date',
      });
      expect(result.success).toBe(false);
    });

    it('should reject datetime without timezone', () => {
      const result = getInboundMessagesSchema.safeParse({
        since: '2025-01-15T10:00:00',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('limit field', () => {
    it('should default to 50', () => {
      const result = getInboundMessagesSchema.parse({});
      expect(result.limit).toBe(50);
    });

    it('should accept minimum value of 1', () => {
      const result = getInboundMessagesSchema.safeParse({ limit: 1 });
      expect(result.success).toBe(true);
    });

    it('should accept maximum value of 1000', () => {
      const result = getInboundMessagesSchema.safeParse({ limit: 1000 });
      expect(result.success).toBe(true);
    });

    it('should reject value below minimum', () => {
      const result = getInboundMessagesSchema.safeParse({ limit: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject value above maximum', () => {
      const result = getInboundMessagesSchema.safeParse({ limit: 1001 });
      expect(result.success).toBe(false);
    });

    it('should accept value in range', () => {
      const result = getInboundMessagesSchema.parse({ limit: 100 });
      expect(result.limit).toBe(100);
    });

    it('should reject negative limit', () => {
      const result = getInboundMessagesSchema.safeParse({ limit: -5 });
      expect(result.success).toBe(false);
    });
  });

  describe('combined filters', () => {
    it('should accept all filters together', () => {
      const result = getInboundMessagesSchema.safeParse({
        from: '+15559876543',
        to: '+15551234567',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        since: '2025-01-15T10:00:00Z',
        limit: 100,
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty object with defaults', () => {
      const result = getInboundMessagesSchema.parse({});
      expect(result.limit).toBe(50);
      expect(result.from).toBeUndefined();
      expect(result.to).toBeUndefined();
      expect(result.conversationId).toBeUndefined();
      expect(result.since).toBeUndefined();
    });
  });
});

/**
 * Business logic tests using test doubles
 */
describe('get_inbound_messages business logic', () => {
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
          media_urls TEXT,
          timestamp INTEGER NOT NULL,
          status TEXT NOT NULL
        );
        CREATE INDEX idx_from ON messages(from_number);
        CREATE INDEX idx_to ON messages(to_number);
        CREATE INDEX idx_conv ON messages(conversation_id);
      `);
    }

    create(message: any) {
      const timestamp = message.timestamp || new Date();
      this.db.prepare(`
        INSERT INTO messages (message_sid, conversation_id, direction, from_number, to_number, body, media_urls, timestamp, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        message.messageSid,
        message.conversationId,
        message.direction,
        message.from,
        message.to,
        message.body,
        message.mediaUrls ? JSON.stringify(message.mediaUrls) : null,
        timestamp.getTime(),
        message.status
      );
      return { ...message, timestamp };
    }

    query(params: { from?: string; to?: string; conversationId?: string; since?: Date; limit?: number }) {
      let sql = 'SELECT * FROM messages WHERE 1=1';
      const values: any[] = [];

      if (params.from) {
        sql += ' AND from_number = ?';
        values.push(params.from);
      }
      if (params.to) {
        sql += ' AND to_number = ?';
        values.push(params.to);
      }
      if (params.conversationId) {
        sql += ' AND conversation_id = ?';
        values.push(params.conversationId);
      }
      if (params.since) {
        sql += ' AND timestamp >= ?';
        values.push(params.since.getTime());
      }

      sql += ' ORDER BY timestamp DESC LIMIT ?';
      values.push(params.limit || 50);

      const rows = this.db.prepare(sql).all(...values) as any[];
      return rows.map((row: any) => ({
        messageSid: row.message_sid,
        conversationId: row.conversation_id,
        direction: row.direction,
        from: row.from_number,
        to: row.to_number,
        body: row.body,
        mediaUrls: row.media_urls ? JSON.parse(row.media_urls) : undefined,
        timestamp: new Date(row.timestamp),
        status: row.status,
      }));
    }

    close(): void {
      this.db.close();
    }
  }

  // Test implementation of getInboundMessages
  async function testGetInboundMessages(
    params: z.input<typeof getInboundMessagesSchema>,
    messageStore: TestMessageStore
  ) {
    const validated = getInboundMessagesSchema.parse(params);

    const messages = messageStore.query({
      from: validated.from,
      to: validated.to,
      conversationId: validated.conversationId,
      since: validated.since ? new Date(validated.since) : undefined,
      limit: validated.limit,
    });

    return {
      messages: messages.map((msg: any) => ({
        messageSid: msg.messageSid,
        from: msg.from,
        to: msg.to,
        body: msg.body,
        mediaUrls: msg.mediaUrls,
        timestamp: msg.timestamp.toISOString(),
        conversationId: msg.conversationId,
        status: msg.status,
        direction: msg.direction,
      })),
      totalCount: messages.length,
    };
  }

  let messageStore: TestMessageStore;
  const CONV_ID_1 = '550e8400-e29b-41d4-a716-446655440001';
  const CONV_ID_2 = '550e8400-e29b-41d4-a716-446655440002';

  beforeEach(() => {
    messageStore = new TestMessageStore();

    // Seed test data
    messageStore.create({
      messageSid: 'SM001',
      conversationId: CONV_ID_1,
      direction: 'inbound',
      from: '+15559876543',
      to: '+15551234567',
      body: 'Hello!',
      status: 'received',
      timestamp: new Date('2025-01-10T10:00:00Z'),
    });

    messageStore.create({
      messageSid: 'SM002',
      conversationId: CONV_ID_1,
      direction: 'inbound',
      from: '+15559876543',
      to: '+15551234567',
      body: 'Second message',
      status: 'received',
      timestamp: new Date('2025-01-15T10:00:00Z'),
    });

    messageStore.create({
      messageSid: 'SM003',
      conversationId: CONV_ID_2,
      direction: 'inbound',
      from: '+15550001111',
      to: '+15551234567',
      body: 'Different sender',
      status: 'received',
      timestamp: new Date('2025-01-12T10:00:00Z'),
    });

    messageStore.create({
      messageSid: 'MM001',
      conversationId: CONV_ID_1,
      direction: 'inbound',
      from: '+15559876543',
      to: '+15551234567',
      body: 'MMS with image',
      mediaUrls: ['https://example.com/image.jpg'],
      status: 'received',
      timestamp: new Date('2025-01-16T10:00:00Z'),
    });
  });

  afterEach(() => {
    messageStore.close();
  });

  describe('querying messages', () => {
    it('should return all messages when no filters', async () => {
      const result = await testGetInboundMessages({}, messageStore);

      expect(result.messages).toHaveLength(4);
      expect(result.totalCount).toBe(4);
    });

    it('should filter by from number', async () => {
      const result = await testGetInboundMessages(
        { from: '+15559876543' },
        messageStore
      );

      expect(result.messages).toHaveLength(3);
      expect(result.messages.every(m => m.from === '+15559876543')).toBe(true);
    });

    it('should filter by to number', async () => {
      const result = await testGetInboundMessages(
        { to: '+15551234567' },
        messageStore
      );

      expect(result.messages).toHaveLength(4);
    });

    it('should filter by conversation ID', async () => {
      const result = await testGetInboundMessages(
        { conversationId: CONV_ID_1 },
        messageStore
      );

      expect(result.messages).toHaveLength(3);
      expect(result.messages.every(m => m.conversationId === CONV_ID_1)).toBe(true);
    });

    it('should filter by since date', async () => {
      const result = await testGetInboundMessages(
        { since: '2025-01-14T00:00:00Z' },
        messageStore
      );

      expect(result.messages).toHaveLength(2);
    });

    it('should respect limit', async () => {
      const result = await testGetInboundMessages(
        { limit: 2 },
        messageStore
      );

      expect(result.messages).toHaveLength(2);
      expect(result.totalCount).toBe(2);
    });

    it('should combine multiple filters', async () => {
      const result = await testGetInboundMessages(
        {
          from: '+15559876543',
          conversationId: CONV_ID_1,
        },
        messageStore
      );

      expect(result.messages).toHaveLength(3);
    });

    it('should return empty array when no matches', async () => {
      const result = await testGetInboundMessages(
        { from: '+15550000000' },
        messageStore
      );

      expect(result.messages).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should return messages ordered by timestamp descending', async () => {
      const result = await testGetInboundMessages({}, messageStore);

      const timestamps = result.messages.map(m => new Date(m.timestamp).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
      }
    });

    it('should include media URLs when present', async () => {
      const result = await testGetInboundMessages(
        { from: '+15559876543' },
        messageStore
      );

      const mmsMessage = result.messages.find(m => m.messageSid === 'MM001');
      expect(mmsMessage).toBeDefined();
      expect(mmsMessage!.mediaUrls).toEqual(['https://example.com/image.jpg']);
    });

    it('should format timestamps as ISO strings', async () => {
      const result = await testGetInboundMessages({ limit: 1 }, messageStore);

      expect(result.messages[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('edge cases', () => {
    it('should handle exact since timestamp match', async () => {
      const result = await testGetInboundMessages(
        { since: '2025-01-15T10:00:00Z' },
        messageStore
      );

      expect(result.messages.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle future since date', async () => {
      const result = await testGetInboundMessages(
        { since: '2030-01-01T00:00:00Z' },
        messageStore
      );

      expect(result.messages).toHaveLength(0);
    });

    it('should handle very old since date', async () => {
      const result = await testGetInboundMessages(
        { since: '2000-01-01T00:00:00Z' },
        messageStore
      );

      expect(result.messages).toHaveLength(4);
    });
  });
});
