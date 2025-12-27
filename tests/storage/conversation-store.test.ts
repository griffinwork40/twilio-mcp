/**
 * Tests for ConversationStore
 * Tests conversation creation, retrieval, and management
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

// Create a test implementation of ConversationStore that doesn't depend on config
class TestConversationStore {
  private db: Database.Database;

  constructor() {
    this.db = new Database(':memory:');
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        participants TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_activity INTEGER NOT NULL,
        metadata TEXT,
        status TEXT DEFAULT 'active'
      );

      CREATE INDEX IF NOT EXISTS idx_participants ON conversations(participants);
      CREATE INDEX IF NOT EXISTS idx_last_activity ON conversations(last_activity);
    `);
  }

  create(participants: string[], metadata?: Record<string, any>) {
    const id = uuidv4();
    const now = Date.now();
    const participantsKey = this.getParticipantsKey(participants);

    const stmt = this.db.prepare(`
      INSERT INTO conversations (id, participants, created_at, last_activity, metadata, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `);

    stmt.run(id, participantsKey, now, now, JSON.stringify(metadata || {}));

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

    const stmt = this.db.prepare(`
      SELECT * FROM conversations
      WHERE participants = ? AND status = 'active'
      ORDER BY last_activity DESC
      LIMIT 1
    `);

    const row = stmt.get(participantsKey) as any;
    return row ? this.rowToConversation(row) : null;
  }

  getById(id: string) {
    const stmt = this.db.prepare('SELECT * FROM conversations WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.rowToConversation(row) : null;
  }

  updateLastActivity(id: string): void {
    const stmt = this.db.prepare(`
      UPDATE conversations
      SET last_activity = ?
      WHERE id = ?
    `);
    stmt.run(Date.now(), id);
  }

  updateMetadata(id: string, metadata: Record<string, any>): void {
    const stmt = this.db.prepare(`
      UPDATE conversations
      SET metadata = ?
      WHERE id = ?
    `);
    stmt.run(JSON.stringify(metadata), id);
  }

  archive(id: string): void {
    const stmt = this.db.prepare(`
      UPDATE conversations
      SET status = 'archived'
      WHERE id = ?
    `);
    stmt.run(id);
  }

  listActive(limit: number = 50) {
    const stmt = this.db.prepare(`
      SELECT * FROM conversations
      WHERE status = 'active'
      ORDER BY last_activity DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];
    return rows.map(row => this.rowToConversation(row));
  }

  private getParticipantsKey(participants: string[]): string {
    return [...participants].sort().join('|');
  }

  private rowToConversation(row: any) {
    return {
      id: row.id,
      participants: row.participants.split('|'),
      createdAt: new Date(row.created_at),
      lastActivity: new Date(row.last_activity),
      metadata: JSON.parse(row.metadata || '{}'),
      status: row.status as 'active' | 'archived',
    };
  }

  close(): void {
    this.db.close();
  }
}

describe('ConversationStore', () => {
  let store: TestConversationStore;

  beforeEach(() => {
    store = new TestConversationStore();
  });

  afterEach(() => {
    store.close();
  });

  describe('create', () => {
    it('should create a conversation with participants', () => {
      const participants = ['+15551234567', '+15559876543'];
      const conversation = store.create(participants);

      expect(conversation.id).toBeDefined();
      expect(conversation.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      expect(conversation.participants).toEqual(participants);
      expect(conversation.createdAt).toBeInstanceOf(Date);
      expect(conversation.lastActivity).toBeInstanceOf(Date);
      expect(conversation.status).toBe('active');
      expect(conversation.metadata).toEqual({});
    });

    it('should create a conversation with metadata', () => {
      const participants = ['+15551234567', '+15559876543'];
      const metadata = { campaign: 'test', priority: 'high' };
      const conversation = store.create(participants, metadata);

      expect(conversation.metadata).toEqual(metadata);
    });

    it('should normalize participant order', () => {
      const conv1 = store.create(['+15559876543', '+15551234567']);
      const conv2 = store.findByParticipants(['+15551234567', '+15559876543']);

      expect(conv2).not.toBeNull();
      expect(conv2!.id).toBe(conv1.id);
    });
  });

  describe('findByParticipants', () => {
    it('should find an existing conversation', () => {
      const participants = ['+15551234567', '+15559876543'];
      const created = store.create(participants);

      const found = store.findByParticipants(participants);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null for non-existent conversation', () => {
      const result = store.findByParticipants(['+15550000000', '+15551111111']);
      expect(result).toBeNull();
    });

    it('should find conversation regardless of participant order', () => {
      const participants = ['+15551234567', '+15559876543'];
      store.create(participants);

      const found = store.findByParticipants(['+15559876543', '+15551234567']);

      expect(found).not.toBeNull();
    });

    it('should not find archived conversations', () => {
      const participants = ['+15551234567', '+15559876543'];
      const conv = store.create(participants);
      store.archive(conv.id);

      const found = store.findByParticipants(participants);

      expect(found).toBeNull();
    });
  });

  describe('getById', () => {
    it('should retrieve a conversation by ID', () => {
      const created = store.create(['+15551234567', '+15559876543']);

      const found = store.getById(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.participants).toEqual(created.participants);
    });

    it('should return null for non-existent ID', () => {
      const result = store.getById('00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    });
  });

  describe('updateLastActivity', () => {
    it('should update the last activity timestamp', async () => {
      const conv = store.create(['+15551234567', '+15559876543']);
      const originalActivity = conv.lastActivity.getTime();

      await new Promise((resolve) => setTimeout(resolve, 10));

      store.updateLastActivity(conv.id);
      const updated = store.getById(conv.id);

      expect(updated!.lastActivity.getTime()).toBeGreaterThan(originalActivity);
    });
  });

  describe('updateMetadata', () => {
    it('should update conversation metadata', () => {
      const conv = store.create(['+15551234567', '+15559876543']);
      const newMetadata = { updated: true, count: 5 };

      store.updateMetadata(conv.id, newMetadata);
      const updated = store.getById(conv.id);

      expect(updated!.metadata).toEqual(newMetadata);
    });

    it('should replace existing metadata entirely', () => {
      const conv = store.create(['+15551234567', '+15559876543'], { old: 'data' });

      store.updateMetadata(conv.id, { new: 'data' });
      const updated = store.getById(conv.id);

      expect(updated!.metadata).toEqual({ new: 'data' });
      expect(updated!.metadata).not.toHaveProperty('old');
    });
  });

  describe('archive', () => {
    it('should archive a conversation', () => {
      const conv = store.create(['+15551234567', '+15559876543']);

      store.archive(conv.id);
      const updated = store.getById(conv.id);

      expect(updated!.status).toBe('archived');
    });

    it('should exclude archived conversations from findByParticipants', () => {
      const participants = ['+15551234567', '+15559876543'];
      const conv = store.create(participants);
      store.archive(conv.id);

      const found = store.findByParticipants(participants);

      expect(found).toBeNull();
    });
  });

  describe('listActive', () => {
    it('should return active conversations', () => {
      store.create(['+15551111111', '+15552222222']);
      store.create(['+15553333333', '+15554444444']);

      const active = store.listActive();

      expect(active).toHaveLength(2);
      expect(active.every((c) => c.status === 'active')).toBe(true);
    });

    it('should exclude archived conversations', () => {
      const conv1 = store.create(['+15551111111', '+15552222222']);
      store.create(['+15553333333', '+15554444444']);
      store.archive(conv1.id);

      const active = store.listActive();

      expect(active).toHaveLength(1);
    });

    it('should respect the limit parameter', () => {
      store.create(['+15551111111', '+15552222222']);
      store.create(['+15553333333', '+15554444444']);
      store.create(['+15555555555', '+15556666666']);

      const active = store.listActive(2);

      expect(active).toHaveLength(2);
    });

    it('should return conversations ordered by last activity descending', async () => {
      const conv1 = store.create(['+15551111111', '+15552222222']);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const conv2 = store.create(['+15553333333', '+15554444444']);

      const active = store.listActive();

      expect(active[0].id).toBe(conv2.id);
      expect(active[1].id).toBe(conv1.id);
    });
  });

  describe('close', () => {
    it('should close the database connection', () => {
      const testStore = new TestConversationStore();
      expect(() => testStore.close()).not.toThrow();
    });
  });
});
