/**
 * Comprehensive tests for conversation threading logic
 * Tests the bi-directional matching and normalization behavior
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

/**
 * Test implementation of ConversationStore with full threading logic
 */
class ConversationStoreWithThreading {
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
      CREATE INDEX idx_last_activity ON conversations(last_activity);
    `);
  }

  /**
   * Generate a normalized participants key for lookup
   * This is the key functionality for bi-directional matching
   */
  private getParticipantsKey(participants: string[]): string {
    return [...participants].sort().join('|');
  }

  create(participants: string[], metadata?: Record<string, any>) {
    const id = uuidv4();
    const now = Date.now();
    const participantsKey = this.getParticipantsKey(participants);

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
    const participantsKey = this.getParticipantsKey(participants);

    const row = this.db.prepare(`
      SELECT * FROM conversations
      WHERE participants = ? AND status = 'active'
      ORDER BY last_activity DESC
      LIMIT 1
    `).get(participantsKey) as any;

    return row ? this.rowToConversation(row) : null;
  }

  getById(id: string) {
    const row = this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as any;
    return row ? this.rowToConversation(row) : null;
  }

  updateLastActivity(id: string): void {
    this.db.prepare('UPDATE conversations SET last_activity = ? WHERE id = ?')
      .run(Date.now(), id);
  }

  archive(id: string): void {
    this.db.prepare('UPDATE conversations SET status = ? WHERE id = ?')
      .run('archived', id);
  }

  listActive(limit: number = 50) {
    const rows = this.db.prepare(`
      SELECT * FROM conversations WHERE status = 'active' 
      ORDER BY last_activity DESC LIMIT ?
    `).all(limit) as any[];
    return rows.map(row => this.rowToConversation(row));
  }

  private rowToConversation(row: any) {
    return {
      id: row.id,
      participants: row.participants.split('|'),
      createdAt: new Date(row.created_at),
      lastActivity: new Date(row.last_activity),
      metadata: JSON.parse(row.metadata || '{}'),
      status: row.status,
    };
  }

  close(): void {
    this.db.close();
  }
}

describe('Conversation Threading', () => {
  let store: ConversationStoreWithThreading;

  beforeEach(() => {
    store = new ConversationStoreWithThreading();
  });

  afterEach(() => {
    store.close();
  });

  describe('normalized participant key generation', () => {
    it('should normalize participants alphabetically', () => {
      // Create conversation with B, A order
      const conv = store.create(['+15559876543', '+15551234567']);

      // Find with A, B order
      const found = store.findByParticipants(['+15551234567', '+15559876543']);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(conv.id);
    });

    it('should store participants in sorted order', () => {
      const conv = store.create(['+15559999999', '+15550000000']);

      // The stored conversation should have participants sorted
      const retrieved = store.getById(conv.id);
      expect(retrieved!.participants).toEqual(['+15550000000', '+15559999999']);
    });

    it('should match regardless of input order', () => {
      // Create with order A
      const conv = store.create(['+15551111111', '+15552222222']);

      // All these should find the same conversation
      const orders = [
        ['+15551111111', '+15552222222'],
        ['+15552222222', '+15551111111'],
      ];

      orders.forEach(participants => {
        const found = store.findByParticipants(participants);
        expect(found).not.toBeNull();
        expect(found!.id).toBe(conv.id);
      });
    });
  });

  describe('bi-directional message threading', () => {
    it('should link A→B and B→A to same conversation', () => {
      const phoneA = '+15551234567';
      const phoneB = '+15559876543';

      // First message: A sends to B
      let conversation = store.findByParticipants([phoneA, phoneB]);
      if (!conversation) {
        conversation = store.create([phoneA, phoneB]);
      }
      const conversationId = conversation.id;

      // Second message: B replies to A (reversed order)
      const foundConv = store.findByParticipants([phoneB, phoneA]);

      expect(foundConv).not.toBeNull();
      expect(foundConv!.id).toBe(conversationId);
    });

    it('should maintain single conversation thread for SMS exchange', () => {
      const twilioNumber = '+15551234567';
      const userNumber = '+15559876543';

      // Simulate outbound SMS (Twilio → User)
      const outboundConv = store.findByParticipants([twilioNumber, userNumber])
        || store.create([twilioNumber, userNumber]);

      // Simulate inbound SMS (User → Twilio)
      const inboundConv = store.findByParticipants([userNumber, twilioNumber]);

      // Should be the same conversation
      expect(inboundConv).not.toBeNull();
      expect(inboundConv!.id).toBe(outboundConv.id);
    });

    it('should create separate conversations for different participant pairs', () => {
      const twilioNumber = '+15551234567';
      const user1 = '+15559876543';
      const user2 = '+15550001111';

      const conv1 = store.create([twilioNumber, user1]);
      const conv2 = store.create([twilioNumber, user2]);

      expect(conv1.id).not.toBe(conv2.id);

      // Each should be independently findable
      const found1 = store.findByParticipants([twilioNumber, user1]);
      const found2 = store.findByParticipants([twilioNumber, user2]);

      expect(found1!.id).toBe(conv1.id);
      expect(found2!.id).toBe(conv2.id);
    });
  });

  describe('multi-party conversation threading', () => {
    it('should create conversation with more than 2 participants', () => {
      const participants = ['+15551111111', '+15552222222', '+15553333333'];
      const conv = store.create(participants);

      expect(conv.participants).toHaveLength(3);
    });

    it('should normalize multi-party participant order', () => {
      const participants = ['+15553333333', '+15551111111', '+15552222222'];
      store.create(participants);

      // Find with different order
      const found = store.findByParticipants(['+15552222222', '+15553333333', '+15551111111']);

      expect(found).not.toBeNull();
      expect(found!.participants).toEqual(['+15551111111', '+15552222222', '+15553333333']);
    });

    it('should treat different participant sets as different conversations', () => {
      const conv1 = store.create(['+15551111111', '+15552222222']);
      const conv2 = store.create(['+15551111111', '+15552222222', '+15553333333']);

      expect(conv1.id).not.toBe(conv2.id);

      // Adding a participant creates a new conversation, doesn't extend existing
      const found = store.findByParticipants(['+15551111111', '+15552222222']);
      expect(found!.id).toBe(conv1.id);
    });
  });

  describe('conversation lifecycle', () => {
    it('should not find archived conversations for threading', () => {
      const participants = ['+15551234567', '+15559876543'];
      const conv = store.create(participants);
      store.archive(conv.id);

      // Archived conversation should not be found
      const found = store.findByParticipants(participants);
      expect(found).toBeNull();
    });

    it('should allow new conversation after archiving', () => {
      const participants = ['+15551234567', '+15559876543'];
      const conv1 = store.create(participants);
      store.archive(conv1.id);

      // Create new conversation with same participants
      const conv2 = store.create(participants);

      expect(conv2.id).not.toBe(conv1.id);

      // New conversation should be findable
      const found = store.findByParticipants(participants);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(conv2.id);
    });

    it('should update last activity timestamp', async () => {
      const conv = store.create(['+15551234567', '+15559876543']);
      const originalActivity = conv.lastActivity.getTime();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      store.updateLastActivity(conv.id);
      const updated = store.getById(conv.id);

      expect(updated!.lastActivity.getTime()).toBeGreaterThan(originalActivity);
    });
  });

  describe('edge cases', () => {
    it('should handle same number appearing multiple times', () => {
      // Technically shouldn't happen, but testing robustness
      const participants = ['+15551234567', '+15551234567'];
      const conv = store.create(participants);

      expect(conv.id).toBeDefined();
    });

    it('should handle international numbers from different countries', () => {
      const usNumber = '+15551234567';
      const ukNumber = '+447911123456';
      const frNumber = '+33612345678';

      const conv1 = store.create([usNumber, ukNumber]);
      const conv2 = store.create([usNumber, frNumber]);
      const conv3 = store.create([ukNumber, frNumber]);

      // All should be separate conversations
      expect(conv1.id).not.toBe(conv2.id);
      expect(conv2.id).not.toBe(conv3.id);
      expect(conv1.id).not.toBe(conv3.id);

      // Each should be findable
      expect(store.findByParticipants([usNumber, ukNumber])!.id).toBe(conv1.id);
      expect(store.findByParticipants([ukNumber, usNumber])!.id).toBe(conv1.id);
    });

    it('should handle very similar phone numbers', () => {
      const num1 = '+15551234567';
      const num2 = '+15551234568'; // One digit different

      store.create([num1, num2]);

      // Should find with exact numbers
      const found = store.findByParticipants([num1, num2]);
      expect(found).not.toBeNull();

      // Should not find with wrong number
      const notFound = store.findByParticipants([num1, '+15551234569']);
      expect(notFound).toBeNull();
    });

    it('should handle short codes in threading', () => {
      const regularNumber = '+15551234567';
      const shortCode = '+12345'; // Short code format

      const conv = store.create([regularNumber, shortCode]);

      const found = store.findByParticipants([shortCode, regularNumber]);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(conv.id);
    });
  });

  describe('metadata preservation', () => {
    it('should preserve metadata through threading operations', () => {
      const metadata = {
        source: 'inbound_sms',
        campaign: 'test',
        customData: { nested: 'value' },
      };

      store.create(['+15551234567', '+15559876543'], metadata);

      const found = store.findByParticipants(['+15559876543', '+15551234567']);
      expect(found!.metadata).toEqual(metadata);
    });

    it('should store empty metadata by default', () => {
      store.create(['+15551234567', '+15559876543']);

      const found = store.findByParticipants(['+15551234567', '+15559876543']);
      expect(found!.metadata).toEqual({});
    });
  });

  describe('concurrent conversation scenarios', () => {
    it('should handle multiple active conversations', () => {
      const twilioNumber = '+15551234567';

      // Create 10 different conversations
      const conversations = [];
      for (let i = 0; i < 10; i++) {
        const userNumber = `+1555${String(i).padStart(7, '0')}`;
        const conv = store.create([twilioNumber, userNumber]);
        conversations.push(conv);
      }

      // All should be independently retrievable
      for (let i = 0; i < 10; i++) {
        const userNumber = `+1555${String(i).padStart(7, '0')}`;
        const found = store.findByParticipants([twilioNumber, userNumber]);
        expect(found).not.toBeNull();
        expect(found!.id).toBe(conversations[i].id);
      }
    });

    it('should list active conversations ordered by last activity', async () => {
      const twilioNumber = '+15551234567';

      // Create conversations with different activity times
      const conv1 = store.create([twilioNumber, '+15550000001']);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const conv2 = store.create([twilioNumber, '+15550000002']);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update conv1 to be most recent
      store.updateLastActivity(conv1.id);

      const active = store.listActive();

      expect(active[0].id).toBe(conv1.id); // Most recent due to update
      expect(active[1].id).toBe(conv2.id);
    });
  });
});
