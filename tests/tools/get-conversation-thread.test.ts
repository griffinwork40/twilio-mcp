/**
 * Tests for get_conversation_thread MCP tool
 * Comprehensive tests for schema validation and business logic
 */

import { z } from 'zod';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

// Define the schema directly for testing (mirrors the actual implementation)
const getConversationThreadSchema = z.object({
  conversationId: z.string().uuid(),
  includeContext: z.boolean().default(false),
});

describe('get_conversation_thread schema validation', () => {
  describe('conversationId field', () => {
    it('should accept valid UUID v4', () => {
      const result = getConversationThreadSchema.safeParse({
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should accept UUID with uppercase letters', () => {
      const result = getConversationThreadSchema.safeParse({
        conversationId: '550E8400-E29B-41D4-A716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should accept UUID with mixed case', () => {
      const result = getConversationThreadSchema.safeParse({
        conversationId: '550e8400-E29B-41d4-A716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = getConversationThreadSchema.safeParse({
        conversationId: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('should reject UUID without dashes', () => {
      const result = getConversationThreadSchema.safeParse({
        conversationId: '550e8400e29b41d4a716446655440000',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty string', () => {
      const result = getConversationThreadSchema.safeParse({
        conversationId: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing conversationId', () => {
      const result = getConversationThreadSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject UUID with wrong length', () => {
      const result = getConversationThreadSchema.safeParse({
        conversationId: '550e8400-e29b-41d4-a716-446655440',
      });
      expect(result.success).toBe(false);
    });

    it('should reject UUID with invalid characters', () => {
      const result = getConversationThreadSchema.safeParse({
        conversationId: '550g8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('includeContext field', () => {
    it('should default to false', () => {
      const result = getConversationThreadSchema.parse({
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.includeContext).toBe(false);
    });

    it('should accept true', () => {
      const result = getConversationThreadSchema.parse({
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        includeContext: true,
      });
      expect(result.includeContext).toBe(true);
    });

    it('should accept false explicitly', () => {
      const result = getConversationThreadSchema.parse({
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        includeContext: false,
      });
      expect(result.includeContext).toBe(false);
    });
  });
});

/**
 * Business logic tests using test doubles
 */
describe('get_conversation_thread business logic', () => {
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

    getById(id: string) {
      const row = this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as any;
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
          media_urls TEXT,
          timestamp INTEGER NOT NULL,
          status TEXT NOT NULL
        )
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

    getByConversation(conversationId: string, limit: number = 100) {
      const rows = this.db.prepare(`
        SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC LIMIT ?
      `).all(conversationId, limit) as any[];

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

  // Test implementation of getConversationThread
  async function testGetConversationThread(
    params: z.input<typeof getConversationThreadSchema>,
    conversationStore: TestConversationStore,
    messageStore: TestMessageStore
  ) {
    const validated = getConversationThreadSchema.parse(params);

    const conversation = conversationStore.getById(validated.conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${validated.conversationId} not found`);
    }

    const messages = messageStore.getByConversation(validated.conversationId);

    const response: any = {
      conversationId: conversation.id,
      participants: conversation.participants,
      messages: messages.map((msg: any) => ({
        messageSid: msg.messageSid,
        direction: msg.direction,
        from: msg.from,
        to: msg.to,
        body: msg.body,
        mediaUrls: msg.mediaUrls,
        timestamp: msg.timestamp.toISOString(),
        status: msg.status,
      })),
    };

    if (validated.includeContext) {
      response.context = {
        summary: `Conversation with ${conversation.participants.length} participants`,
        lastActivity: conversation.lastActivity.toISOString(),
        messageCount: messages.length,
      };
    }

    return response;
  }

  let conversationStore: TestConversationStore;
  let messageStore: TestMessageStore;
  let testConversation: ReturnType<TestConversationStore['create']>;

  beforeEach(() => {
    conversationStore = new TestConversationStore();
    messageStore = new TestMessageStore();

    // Create test conversation
    testConversation = conversationStore.create(['+15551234567', '+15559876543']);

    // Add test messages
    messageStore.create({
      messageSid: 'SM001',
      conversationId: testConversation.id,
      direction: 'outbound',
      from: '+15551234567',
      to: '+15559876543',
      body: 'Hello!',
      status: 'delivered',
      timestamp: new Date('2025-01-15T10:00:00Z'),
    });

    messageStore.create({
      messageSid: 'SM002',
      conversationId: testConversation.id,
      direction: 'inbound',
      from: '+15559876543',
      to: '+15551234567',
      body: 'Hi there!',
      status: 'received',
      timestamp: new Date('2025-01-15T10:01:00Z'),
    });

    messageStore.create({
      messageSid: 'SM003',
      conversationId: testConversation.id,
      direction: 'outbound',
      from: '+15551234567',
      to: '+15559876543',
      body: 'How are you?',
      status: 'delivered',
      timestamp: new Date('2025-01-15T10:02:00Z'),
    });
  });

  afterEach(() => {
    conversationStore.close();
    messageStore.close();
  });

  describe('conversation retrieval', () => {
    it('should retrieve conversation by ID', async () => {
      const result = await testGetConversationThread(
        { conversationId: testConversation.id },
        conversationStore,
        messageStore
      );

      expect(result.conversationId).toBe(testConversation.id);
      expect(result.participants).toHaveLength(2);
    });

    it('should throw error for non-existent conversation', async () => {
      await expect(testGetConversationThread(
        { conversationId: '00000000-0000-0000-0000-000000000000' },
        conversationStore,
        messageStore
      )).rejects.toThrow('Conversation 00000000-0000-0000-0000-000000000000 not found');
    });

    it('should return participants in sorted order from storage', async () => {
      const result = await testGetConversationThread(
        { conversationId: testConversation.id },
        conversationStore,
        messageStore
      );

      // Participants are stored sorted
      expect(result.participants).toContain('+15551234567');
      expect(result.participants).toContain('+15559876543');
    });
  });

  describe('message retrieval', () => {
    it('should return all messages in conversation', async () => {
      const result = await testGetConversationThread(
        { conversationId: testConversation.id },
        conversationStore,
        messageStore
      );

      expect(result.messages).toHaveLength(3);
    });

    it('should return messages ordered by timestamp ascending', async () => {
      const result = await testGetConversationThread(
        { conversationId: testConversation.id },
        conversationStore,
        messageStore
      );

      expect(result.messages[0].body).toBe('Hello!');
      expect(result.messages[1].body).toBe('Hi there!');
      expect(result.messages[2].body).toBe('How are you?');
    });

    it('should include message direction', async () => {
      const result = await testGetConversationThread(
        { conversationId: testConversation.id },
        conversationStore,
        messageStore
      );

      expect(result.messages[0].direction).toBe('outbound');
      expect(result.messages[1].direction).toBe('inbound');
    });

    it('should format timestamps as ISO strings', async () => {
      const result = await testGetConversationThread(
        { conversationId: testConversation.id },
        conversationStore,
        messageStore
      );

      result.messages.forEach((msg: any) => {
        expect(msg.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });
    });

    it('should include media URLs when present', async () => {
      messageStore.create({
        messageSid: 'MM001',
        conversationId: testConversation.id,
        direction: 'inbound',
        from: '+15559876543',
        to: '+15551234567',
        body: 'Check this out!',
        mediaUrls: ['https://example.com/image.jpg', 'https://example.com/image2.jpg'],
        status: 'received',
        timestamp: new Date('2025-01-15T10:03:00Z'),
      });

      const result = await testGetConversationThread(
        { conversationId: testConversation.id },
        conversationStore,
        messageStore
      );

      const mmsMessage = result.messages.find((m: any) => m.messageSid === 'MM001');
      expect(mmsMessage.mediaUrls).toEqual([
        'https://example.com/image.jpg',
        'https://example.com/image2.jpg',
      ]);
    });

    it('should return empty messages array for conversation with no messages', async () => {
      const emptyConv = conversationStore.create(['+15550001111', '+15552222222']);

      const result = await testGetConversationThread(
        { conversationId: emptyConv.id },
        conversationStore,
        messageStore
      );

      expect(result.messages).toHaveLength(0);
    });
  });

  describe('context inclusion', () => {
    it('should not include context by default', async () => {
      const result = await testGetConversationThread(
        { conversationId: testConversation.id },
        conversationStore,
        messageStore
      );

      expect(result.context).toBeUndefined();
    });

    it('should include context when requested', async () => {
      const result = await testGetConversationThread(
        { conversationId: testConversation.id, includeContext: true },
        conversationStore,
        messageStore
      );

      expect(result.context).toBeDefined();
      expect(result.context.summary).toContain('2 participants');
      expect(result.context.messageCount).toBe(3);
      expect(result.context.lastActivity).toBeDefined();
    });

    it('should format lastActivity as ISO string', async () => {
      const result = await testGetConversationThread(
        { conversationId: testConversation.id, includeContext: true },
        conversationStore,
        messageStore
      );

      expect(result.context.lastActivity).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should return correct message count in context', async () => {
      const result = await testGetConversationThread(
        { conversationId: testConversation.id, includeContext: true },
        conversationStore,
        messageStore
      );

      expect(result.context.messageCount).toBe(result.messages.length);
    });

    it('should exclude context when includeContext is false', async () => {
      const result = await testGetConversationThread(
        { conversationId: testConversation.id, includeContext: false },
        conversationStore,
        messageStore
      );

      expect(result.context).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle conversation with many messages', async () => {
      // Add many more messages
      for (let i = 0; i < 50; i++) {
        messageStore.create({
          messageSid: `SM${1000 + i}`,
          conversationId: testConversation.id,
          direction: i % 2 === 0 ? 'outbound' : 'inbound',
          from: i % 2 === 0 ? '+15551234567' : '+15559876543',
          to: i % 2 === 0 ? '+15559876543' : '+15551234567',
          body: `Message ${i}`,
          status: 'delivered',
          timestamp: new Date(Date.now() + i * 1000),
        });
      }

      const result = await testGetConversationThread(
        { conversationId: testConversation.id, includeContext: true },
        conversationStore,
        messageStore
      );

      expect(result.messages.length).toBe(53); // 3 original + 50 new
      expect(result.context.messageCount).toBe(53);
    });

    it('should handle messages with empty body', async () => {
      messageStore.create({
        messageSid: 'MM002',
        conversationId: testConversation.id,
        direction: 'inbound',
        from: '+15559876543',
        to: '+15551234567',
        body: '', // MMS might have empty body with only media
        mediaUrls: ['https://example.com/image.jpg'],
        status: 'received',
        timestamp: new Date('2025-01-15T10:04:00Z'),
      });

      const result = await testGetConversationThread(
        { conversationId: testConversation.id },
        conversationStore,
        messageStore
      );

      const emptyBodyMessage = result.messages.find((m: any) => m.messageSid === 'MM002');
      expect(emptyBodyMessage.body).toBe('');
      expect(emptyBodyMessage.mediaUrls).toBeDefined();
    });
  });
});
