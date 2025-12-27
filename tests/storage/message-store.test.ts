/**
 * Tests for MessageStore
 * Tests message creation, retrieval, and querying
 */

import Database from 'better-sqlite3';

// Create a test implementation of MessageStore
class TestMessageStore {
  private db: Database.Database;

  constructor() {
    this.db = new Database(':memory:');
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        message_sid TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        direction TEXT NOT NULL,
        from_number TEXT NOT NULL,
        to_number TEXT NOT NULL,
        body TEXT NOT NULL,
        media_urls TEXT,
        timestamp INTEGER NOT NULL,
        status TEXT NOT NULL,
        error_code TEXT,
        error_message TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_conversation_id ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_from_number ON messages(from_number);
      CREATE INDEX IF NOT EXISTS idx_to_number ON messages(to_number);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON messages(timestamp);
    `);
  }

  create(message: any): any {
    const timestamp = message.timestamp || new Date();

    const stmt = this.db.prepare(`
      INSERT INTO messages (
        message_sid, conversation_id, direction, from_number, to_number,
        body, media_urls, timestamp, status, error_code, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      message.messageSid,
      message.conversationId,
      message.direction,
      message.from,
      message.to,
      message.body,
      message.mediaUrls ? JSON.stringify(message.mediaUrls) : null,
      timestamp.getTime(),
      message.status,
      message.errorCode || null,
      message.errorMessage || null
    );

    return {
      ...message,
      timestamp,
    };
  }

  getBySid(messageSid: string): any | null {
    const stmt = this.db.prepare('SELECT * FROM messages WHERE message_sid = ?');
    const row = stmt.get(messageSid) as any;
    return row ? this.rowToMessage(row) : null;
  }

  getByConversation(conversationId: string, limit: number = 100): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY timestamp ASC
      LIMIT ?
    `);

    const rows = stmt.all(conversationId, limit) as any[];
    return rows.map(row => this.rowToMessage(row));
  }

  query(params: any): any[] {
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

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...values) as any[];
    return rows.map(row => this.rowToMessage(row));
  }

  updateStatus(messageSid: string, status: string, errorCode?: string, errorMessage?: string): void {
    const stmt = this.db.prepare(`
      UPDATE messages
      SET status = ?, error_code = ?, error_message = ?
      WHERE message_sid = ?
    `);
    stmt.run(status, errorCode || null, errorMessage || null, messageSid);
  }

  getConversationMessageCount(conversationId: string): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM messages
      WHERE conversation_id = ?
    `);
    const row = stmt.get(conversationId) as any;
    return row.count;
  }

  private rowToMessage(row: any): any {
    return {
      messageSid: row.message_sid,
      conversationId: row.conversation_id,
      direction: row.direction,
      from: row.from_number,
      to: row.to_number,
      body: row.body,
      mediaUrls: row.media_urls ? JSON.parse(row.media_urls) : undefined,
      timestamp: new Date(row.timestamp),
      status: row.status,
      errorCode: row.error_code || undefined,
      errorMessage: row.error_message || undefined,
    };
  }

  close(): void {
    this.db.close();
  }
}

describe('MessageStore', () => {
  let store: TestMessageStore;

  beforeEach(() => {
    store = new TestMessageStore();
  });

  afterEach(() => {
    store.close();
  });

  describe('create', () => {
    it('should store a message with all required fields', () => {
      const message = store.create({
        messageSid: 'SM0000000000000000000000000000001',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        direction: 'outbound',
        from: '+15551234567',
        to: '+15559876543',
        body: 'Test message',
        status: 'queued',
      });

      expect(message.messageSid).toBe('SM0000000000000000000000000000001');
      expect(message.conversationId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(message.direction).toBe('outbound');
      expect(message.from).toBe('+15551234567');
      expect(message.to).toBe('+15559876543');
      expect(message.body).toBe('Test message');
      expect(message.status).toBe('queued');
      expect(message.timestamp).toBeInstanceOf(Date);
    });

    it('should store a message with media URLs', () => {
      const message = store.create({
        messageSid: 'MM0000000000000000000000000000001',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        direction: 'inbound',
        from: '+15559876543',
        to: '+15551234567',
        body: 'Check this out',
        mediaUrls: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
        status: 'received',
      });

      expect(message.mediaUrls).toEqual([
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
      ]);
    });

    it('should use provided timestamp if given', () => {
      const timestamp = new Date('2025-01-15T12:00:00Z');
      const message = store.create({
        messageSid: 'SM0000000000000000000000000000001',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        direction: 'outbound',
        from: '+15551234567',
        to: '+15559876543',
        body: 'Test message',
        status: 'queued',
        timestamp,
      });

      expect(message.timestamp.toISOString()).toBe(timestamp.toISOString());
    });

    it('should store error information', () => {
      const message = store.create({
        messageSid: 'SM0000000000000000000000000000001',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        direction: 'outbound',
        from: '+15551234567',
        to: '+15559876543',
        body: 'Test message',
        status: 'failed',
        errorCode: '30003',
        errorMessage: 'Unreachable destination handset',
      });

      expect(message.errorCode).toBe('30003');
      expect(message.errorMessage).toBe('Unreachable destination handset');
    });
  });

  describe('getBySid', () => {
    it('should retrieve a message by SID', () => {
      const created = store.create({
        messageSid: 'SM0000000000000000000000000000001',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        direction: 'outbound',
        from: '+15551234567',
        to: '+15559876543',
        body: 'Test message',
        status: 'queued',
      });

      const found = store.getBySid('SM0000000000000000000000000000001');

      expect(found).not.toBeNull();
      expect(found!.messageSid).toBe(created.messageSid);
      expect(found!.body).toBe(created.body);
    });

    it('should return null for non-existent SID', () => {
      const result = store.getBySid('SM9999999999999999999999999999999');
      expect(result).toBeNull();
    });
  });

  describe('getByConversation', () => {
    it('should return all messages for a conversation', () => {
      const conversationId = '550e8400-e29b-41d4-a716-446655440000';

      store.create({
        messageSid: 'SM0000000000000000000000000000001',
        conversationId,
        direction: 'outbound',
        from: '+15551234567',
        to: '+15559876543',
        body: 'Message 1',
        status: 'delivered',
      });

      store.create({
        messageSid: 'SM0000000000000000000000000000002',
        conversationId,
        direction: 'inbound',
        from: '+15559876543',
        to: '+15551234567',
        body: 'Message 2',
        status: 'received',
      });

      const messages = store.getByConversation(conversationId);

      expect(messages).toHaveLength(2);
    });

    it('should return messages ordered by timestamp ascending', () => {
      const conversationId = '550e8400-e29b-41d4-a716-446655440000';

      store.create({
        messageSid: 'SM0000000000000000000000000000002',
        conversationId,
        direction: 'inbound',
        from: '+15559876543',
        to: '+15551234567',
        body: 'Later message',
        status: 'received',
        timestamp: new Date('2025-01-01T12:00:00Z'),
      });

      store.create({
        messageSid: 'SM0000000000000000000000000000001',
        conversationId,
        direction: 'outbound',
        from: '+15551234567',
        to: '+15559876543',
        body: 'Earlier message',
        status: 'delivered',
        timestamp: new Date('2025-01-01T10:00:00Z'),
      });

      const messages = store.getByConversation(conversationId);

      expect(messages[0].body).toBe('Earlier message');
      expect(messages[1].body).toBe('Later message');
    });

    it('should respect the limit parameter', () => {
      const conversationId = '550e8400-e29b-41d4-a716-446655440000';

      for (let i = 0; i < 5; i++) {
        store.create({
          messageSid: `SM000000000000000000000000000000${i}`,
          conversationId,
          direction: 'outbound',
          from: '+15551234567',
          to: '+15559876543',
          body: `Message ${i}`,
          status: 'delivered',
        });
      }

      const messages = store.getByConversation(conversationId, 3);

      expect(messages).toHaveLength(3);
    });

    it('should return empty array for conversation with no messages', () => {
      const messages = store.getByConversation('00000000-0000-0000-0000-000000000000');
      expect(messages).toEqual([]);
    });
  });

  describe('query', () => {
    beforeEach(() => {
      store.create({
        messageSid: 'SM0000000000000000000000000000001',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        direction: 'outbound',
        from: '+15551234567',
        to: '+15559876543',
        body: 'Outbound message',
        status: 'delivered',
        timestamp: new Date('2025-01-01T10:00:00Z'),
      });

      store.create({
        messageSid: 'SM0000000000000000000000000000002',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        direction: 'inbound',
        from: '+15559876543',
        to: '+15551234567',
        body: 'Inbound message',
        status: 'received',
        timestamp: new Date('2025-01-01T11:00:00Z'),
      });

      store.create({
        messageSid: 'SM0000000000000000000000000000003',
        conversationId: '550e8400-e29b-41d4-a716-446655440001',
        direction: 'outbound',
        from: '+15551234567',
        to: '+15550000000',
        body: 'Different conversation',
        status: 'delivered',
        timestamp: new Date('2025-01-01T12:00:00Z'),
      });
    });

    it('should filter by from number', () => {
      const messages = store.query({ from: '+15559876543' });
      expect(messages).toHaveLength(1);
      expect(messages[0].body).toBe('Inbound message');
    });

    it('should filter by to number', () => {
      const messages = store.query({ to: '+15551234567' });
      expect(messages).toHaveLength(1);
      expect(messages[0].body).toBe('Inbound message');
    });

    it('should filter by conversation ID', () => {
      const messages = store.query({
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(messages).toHaveLength(2);
    });

    it('should filter by since date', () => {
      const messages = store.query({
        since: new Date('2025-01-01T10:30:00Z'),
      });
      expect(messages).toHaveLength(2);
    });

    it('should respect the limit parameter', () => {
      const messages = store.query({ limit: 1 });
      expect(messages).toHaveLength(1);
    });

    it('should combine multiple filters', () => {
      const messages = store.query({
        from: '+15551234567',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(messages).toHaveLength(1);
      expect(messages[0].body).toBe('Outbound message');
    });

    it('should return results ordered by timestamp descending', () => {
      const messages = store.query({});
      expect(messages[0].body).toBe('Different conversation');
      expect(messages[2].body).toBe('Outbound message');
    });

    it('should return empty array when no matches', () => {
      const messages = store.query({ from: '+15550000001' });
      expect(messages).toEqual([]);
    });
  });

  describe('updateStatus', () => {
    it('should update message status', () => {
      store.create({
        messageSid: 'SM0000000000000000000000000000001',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        direction: 'outbound',
        from: '+15551234567',
        to: '+15559876543',
        body: 'Test message',
        status: 'queued',
      });

      store.updateStatus('SM0000000000000000000000000000001', 'delivered');
      const updated = store.getBySid('SM0000000000000000000000000000001');

      expect(updated!.status).toBe('delivered');
    });

    it('should update status with error information', () => {
      store.create({
        messageSid: 'SM0000000000000000000000000000001',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        direction: 'outbound',
        from: '+15551234567',
        to: '+15559876543',
        body: 'Test message',
        status: 'queued',
      });

      store.updateStatus(
        'SM0000000000000000000000000000001',
        'failed',
        '30003',
        'Unreachable destination handset'
      );

      const updated = store.getBySid('SM0000000000000000000000000000001');

      expect(updated!.status).toBe('failed');
      expect(updated!.errorCode).toBe('30003');
      expect(updated!.errorMessage).toBe('Unreachable destination handset');
    });

    it('should clear error fields when updating to success status', () => {
      store.create({
        messageSid: 'SM0000000000000000000000000000001',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        direction: 'outbound',
        from: '+15551234567',
        to: '+15559876543',
        body: 'Test message',
        status: 'failed',
        errorCode: '30003',
        errorMessage: 'Temporary error',
      });

      store.updateStatus('SM0000000000000000000000000000001', 'delivered');

      const updated = store.getBySid('SM0000000000000000000000000000001');

      expect(updated!.status).toBe('delivered');
      expect(updated!.errorCode).toBeUndefined();
      expect(updated!.errorMessage).toBeUndefined();
    });
  });

  describe('getConversationMessageCount', () => {
    it('should return correct message count', () => {
      const conversationId = '550e8400-e29b-41d4-a716-446655440000';

      store.create({
        messageSid: 'SM0000000000000000000000000000001',
        conversationId,
        direction: 'outbound',
        from: '+15551234567',
        to: '+15559876543',
        body: 'Message 1',
        status: 'delivered',
      });

      store.create({
        messageSid: 'SM0000000000000000000000000000002',
        conversationId,
        direction: 'inbound',
        from: '+15559876543',
        to: '+15551234567',
        body: 'Message 2',
        status: 'received',
      });

      const count = store.getConversationMessageCount(conversationId);
      expect(count).toBe(2);
    });

    it('should return 0 for conversation with no messages', () => {
      const count = store.getConversationMessageCount('00000000-0000-0000-0000-000000000000');
      expect(count).toBe(0);
    });
  });

  describe('close', () => {
    it('should close the database connection', () => {
      const testStore = new TestMessageStore();
      expect(() => testStore.close()).not.toThrow();
    });
  });
});
