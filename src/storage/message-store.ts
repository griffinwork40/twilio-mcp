/**
 * Message storage implementation using SQLite
 * Stores SMS/MMS messages and links them to conversations
 */

import Database from 'better-sqlite3';
import { config } from '../config/env.js';
import type { Message } from '../types/models.js';

export class MessageStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const path = dbPath || config.DATABASE_PATH;
    this.db = new Database(path);
    this.initialize();
  }

  /**
   * Initialize database schema
   */
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
        error_message TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      );

      CREATE INDEX IF NOT EXISTS idx_conversation_id ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_from_number ON messages(from_number);
      CREATE INDEX IF NOT EXISTS idx_to_number ON messages(to_number);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON messages(timestamp);
    `);
  }

  /**
   * Store a new message
   */
  create(message: Omit<Message, 'timestamp'> & { timestamp?: Date }): Message {
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

  /**
   * Get message by SID
   */
  getBySid(messageSid: string): Message | null {
    const stmt = this.db.prepare('SELECT * FROM messages WHERE message_sid = ?');
    const row = stmt.get(messageSid) as any;
    return row ? this.rowToMessage(row) : null;
  }

  /**
   * Get all messages for a conversation
   */
  getByConversation(conversationId: string, limit: number = 100): Message[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY timestamp ASC
      LIMIT ?
    `);

    const rows = stmt.all(conversationId, limit) as any[];
    return rows.map(row => this.rowToMessage(row));
  }

  /**
   * Query messages with filters
   */
  query(params: {
    from?: string;
    to?: string;
    conversationId?: string;
    since?: Date;
    limit?: number;
  }): Message[] {
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

  /**
   * Update message status
   */
  updateStatus(messageSid: string, status: string, errorCode?: string, errorMessage?: string): void {
    const stmt = this.db.prepare(`
      UPDATE messages
      SET status = ?, error_code = ?, error_message = ?
      WHERE message_sid = ?
    `);
    stmt.run(status, errorCode || null, errorMessage || null, messageSid);
  }

  /**
   * Get message count for a conversation
   */
  getConversationMessageCount(conversationId: string): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM messages
      WHERE conversation_id = ?
    `);
    const row = stmt.get(conversationId) as any;
    return row.count;
  }

  /**
   * Convert database row to Message object
   */
  private rowToMessage(row: any): Message {
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

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

// Export singleton
export const messageStore = new MessageStore();
