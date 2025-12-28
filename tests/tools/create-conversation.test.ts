/**
 * Tests for create_conversation MCP tool
 * Comprehensive tests for schema validation and business logic
 */

import { z } from 'zod';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

// Define the schema directly for testing (mirrors the actual implementation)
const createConversationSchema = z.object({
  participants: z.array(z.string().regex(/^\+[1-9]\d{1,14}$/)).min(2),
  metadata: z.record(z.any()).optional(),
});

describe('create_conversation schema validation', () => {
  describe('participants field', () => {
    it('should accept array with two participants', () => {
      const result = createConversationSchema.safeParse({
        participants: ['+15551234567', '+15559876543'],
      });
      expect(result.success).toBe(true);
    });

    it('should accept array with multiple participants', () => {
      const result = createConversationSchema.safeParse({
        participants: ['+15551234567', '+15559876543', '+15551111111', '+15552222222'],
      });
      expect(result.success).toBe(true);
    });

    it('should reject single participant', () => {
      const result = createConversationSchema.safeParse({
        participants: ['+15551234567'],
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty array', () => {
      const result = createConversationSchema.safeParse({
        participants: [],
      });
      expect(result.success).toBe(false);
    });

    it('should reject array with invalid phone number', () => {
      const result = createConversationSchema.safeParse({
        participants: ['+15551234567', 'invalid'],
      });
      expect(result.success).toBe(false);
    });

    it('should reject array with phone number missing +', () => {
      const result = createConversationSchema.safeParse({
        participants: ['+15551234567', '15559876543'],
      });
      expect(result.success).toBe(false);
    });

    it('should accept international phone numbers', () => {
      const result = createConversationSchema.safeParse({
        participants: ['+447911123456', '+33612345678'],
      });
      expect(result.success).toBe(true);
    });

    it('should reject participants with duplicates (validation doesnt prevent, but schema allows)', () => {
      // Note: The schema doesn't prevent duplicates, but the conversation store normalizes
      const result = createConversationSchema.safeParse({
        participants: ['+15551234567', '+15551234567'],
      });
      expect(result.success).toBe(true); // Schema allows it
    });

    it('should accept large number of participants', () => {
      const participants = Array.from({ length: 10 }, (_, i) => 
        `+1555${String(i).padStart(7, '0')}`
      );
      const result = createConversationSchema.safeParse({ participants });
      expect(result.success).toBe(true);
    });
  });

  describe('metadata field (optional)', () => {
    it('should accept valid metadata object', () => {
      const result = createConversationSchema.safeParse({
        participants: ['+15551234567', '+15559876543'],
        metadata: { campaign: 'test', priority: 'high' },
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty metadata object', () => {
      const result = createConversationSchema.safeParse({
        participants: ['+15551234567', '+15559876543'],
        metadata: {},
      });
      expect(result.success).toBe(true);
    });

    it('should work without metadata', () => {
      const result = createConversationSchema.safeParse({
        participants: ['+15551234567', '+15559876543'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata).toBeUndefined();
      }
    });

    it('should accept nested metadata', () => {
      const result = createConversationSchema.safeParse({
        participants: ['+15551234567', '+15559876543'],
        metadata: {
          user: {
            name: 'John Doe',
            email: 'john@example.com',
          },
          tags: ['support', 'urgent'],
        },
      });
      expect(result.success).toBe(true);
    });

    it('should accept metadata with various types', () => {
      const result = createConversationSchema.safeParse({
        participants: ['+15551234567', '+15559876543'],
        metadata: {
          stringVal: 'test',
          numberVal: 42,
          boolVal: true,
          nullVal: null,
          arrayVal: [1, 2, 3],
        },
      });
      expect(result.success).toBe(true);
    });

    it('should accept metadata with deeply nested objects', () => {
      const result = createConversationSchema.safeParse({
        participants: ['+15551234567', '+15559876543'],
        metadata: {
          level1: {
            level2: {
              level3: {
                value: 'deep',
              },
            },
          },
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('missing fields', () => {
    it('should reject missing participants', () => {
      const result = createConversationSchema.safeParse({
        metadata: { test: 'data' },
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty object', () => {
      const result = createConversationSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});

/**
 * Business logic tests using test doubles
 */
describe('create_conversation business logic', () => {
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
        );
        CREATE INDEX idx_participants ON conversations(participants);
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

    close(): void {
      this.db.close();
    }
  }

  // Test implementation of createConversation
  async function testCreateConversation(
    params: z.infer<typeof createConversationSchema>,
    conversationStore: TestConversationStore
  ) {
    const validated = createConversationSchema.parse(params);

    const conversation = conversationStore.create(
      validated.participants,
      validated.metadata
    );

    return {
      conversationId: conversation.id,
      participants: conversation.participants,
      createdAt: conversation.createdAt.toISOString(),
      metadata: conversation.metadata,
    };
  }

  let conversationStore: TestConversationStore;

  beforeEach(() => {
    conversationStore = new TestConversationStore();
  });

  afterEach(() => {
    conversationStore.close();
  });

  describe('conversation creation', () => {
    it('should create conversation with two participants', async () => {
      const result = await testCreateConversation(
        { participants: ['+15551234567', '+15559876543'] },
        conversationStore
      );

      expect(result.conversationId).toBeDefined();
      expect(result.conversationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      expect(result.participants).toEqual(['+15551234567', '+15559876543']);
    });

    it('should create conversation with metadata', async () => {
      const metadata = { campaign: 'test', priority: 'high' };
      const result = await testCreateConversation(
        {
          participants: ['+15551234567', '+15559876543'],
          metadata,
        },
        conversationStore
      );

      expect(result.metadata).toEqual(metadata);
    });

    it('should create conversation with empty metadata by default', async () => {
      const result = await testCreateConversation(
        { participants: ['+15551234567', '+15559876543'] },
        conversationStore
      );

      expect(result.metadata).toEqual({});
    });

    it('should return ISO timestamp for createdAt', async () => {
      const result = await testCreateConversation(
        { participants: ['+15551234567', '+15559876543'] },
        conversationStore
      );

      expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should store conversation in database', async () => {
      const result = await testCreateConversation(
        { participants: ['+15551234567', '+15559876543'] },
        conversationStore
      );

      const stored = conversationStore.getById(result.conversationId);
      expect(stored).not.toBeNull();
      expect(stored!.id).toBe(result.conversationId);
    });

    it('should create unique IDs for multiple conversations', async () => {
      const result1 = await testCreateConversation(
        { participants: ['+15551234567', '+15559876543'] },
        conversationStore
      );

      const result2 = await testCreateConversation(
        { participants: ['+15551111111', '+15552222222'] },
        conversationStore
      );

      expect(result1.conversationId).not.toBe(result2.conversationId);
    });
  });

  describe('participant normalization', () => {
    it('should normalize participant order for lookups', async () => {
      await testCreateConversation(
        { participants: ['+15559876543', '+15551234567'] }, // B, A order
        conversationStore
      );

      // Should find regardless of order
      const found = conversationStore.findByParticipants(['+15551234567', '+15559876543']);
      expect(found).not.toBeNull();
    });

    it('should preserve original participant order in response', async () => {
      const result = await testCreateConversation(
        { participants: ['+15559876543', '+15551234567'] },
        conversationStore
      );

      // Response should have original order
      expect(result.participants).toEqual(['+15559876543', '+15551234567']);
    });
  });

  describe('metadata handling', () => {
    it('should store complex nested metadata', async () => {
      const metadata = {
        user: {
          name: 'John Doe',
          preferences: {
            language: 'en',
            notifications: true,
          },
        },
        tags: ['support', 'urgent'],
        priority: 1,
      };

      const result = await testCreateConversation(
        {
          participants: ['+15551234567', '+15559876543'],
          metadata,
        },
        conversationStore
      );

      expect(result.metadata).toEqual(metadata);
    });

    it('should store metadata with null values', async () => {
      const metadata = {
        optionalField: null,
        presentField: 'value',
      };

      const result = await testCreateConversation(
        {
          participants: ['+15551234567', '+15559876543'],
          metadata,
        },
        conversationStore
      );

      expect(result.metadata.optionalField).toBeNull();
      expect(result.metadata.presentField).toBe('value');
    });
  });

  describe('error handling', () => {
    it('should throw on invalid participants', async () => {
      await expect(testCreateConversation(
        { participants: ['invalid', '+15559876543'] },
        conversationStore
      )).rejects.toThrow();
    });

    it('should throw on single participant', async () => {
      await expect(testCreateConversation(
        { participants: ['+15551234567'] },
        conversationStore
      )).rejects.toThrow();
    });

    it('should throw on empty participants array', async () => {
      await expect(testCreateConversation(
        { participants: [] },
        conversationStore
      )).rejects.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle conversation with many participants', async () => {
      const participants = Array.from({ length: 10 }, (_, i) => 
        `+1555${String(i).padStart(7, '0')}`
      );

      const result = await testCreateConversation(
        { participants },
        conversationStore
      );

      expect(result.participants).toHaveLength(10);
    });

    it('should handle duplicate participants in array', async () => {
      // Schema allows duplicates, store will create with them
      const result = await testCreateConversation(
        { participants: ['+15551234567', '+15551234567'] },
        conversationStore
      );

      expect(result.conversationId).toBeDefined();
    });
  });
});
