/**
 * @fileoverview Message storage implementation using SQLite
 *
 * This module provides persistent storage for SMS/MMS messages using SQLite.
 * Messages are linked to conversations for context tracking and support
 * status updates from Twilio webhooks.
 *
 * @module storage/message-store
 * @author Twilio MCP Team
 * @license MIT
 */

import Database from 'better-sqlite3';
import { config } from '../config/env.js';
import type { Message } from '../types/models.js';

/**
 * MessageStore manages persistent storage of SMS/MMS messages.
 *
 * @description
 * This class provides CRUD operations for messages using SQLite.
 * Key features:
 * - Store inbound and outbound messages
 * - Link messages to conversations
 * - Track delivery status
 * - Store media URLs for MMS
 * - Query with multiple filters
 *
 * Messages use Twilio's message SID as the primary key to ensure
 * uniqueness and enable status updates via webhooks.
 *
 * @example
 * // Using the singleton instance
 * import { messageStore } from './storage/message-store.js';
 *
 * // Store a new message
 * const msg = messageStore.create({
 *   messageSid: 'SMxxxxx',
 *   conversationId: 'uuid',
 *   direction: 'outbound',
 *   from: '+1234567890',
 *   to: '+1987654321',
 *   body: 'Hello!',
 *   status: 'queued',
 * });
 *
 * // Update status after webhook
 * messageStore.updateStatus('SMxxxxx', 'delivered');
 */
export class MessageStore {
  /** @private SQLite database connection */
  private db: Database.Database;

  /**
   * Creates a new MessageStore instance.
   *
   * @description
   * Initializes the SQLite database connection and creates the necessary
   * tables and indexes if they don't exist.
   *
   * @param {string} [dbPath] - Optional path to database file (uses config default if not provided)
   * @throws {Error} If database initialization fails
   */
  constructor(dbPath?: string) {
    const path = dbPath || config.DATABASE_PATH;
    this.db = new Database(path);
    this.initialize();
  }

  /**
   * Initialize database schema.
   *
   * @description
   * Creates the messages table and indexes if they don't exist.
   * Schema includes:
   * - `message_sid` - Twilio SID primary key
   * - `conversation_id` - Foreign key to conversations
   * - `direction` - 'inbound' or 'outbound'
   * - `from_number` - Sender phone number
   * - `to_number` - Recipient phone number
   * - `body` - Message content
   * - `media_urls` - JSON array of media URLs
   * - `timestamp` - Unix timestamp
   * - `status` - Twilio message status
   * - `error_code` - Twilio error code (if failed)
   * - `error_message` - Error description (if failed)
   *
   * @private
   * @returns {void}
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
   * Store a new message.
   *
   * @description
   * Inserts a new message record into the database. The timestamp is
   * automatically set to current time if not provided.
   *
   * @param {Object} message - Message data to store
   * @param {string} message.messageSid - Twilio message SID
   * @param {string} message.conversationId - UUID of associated conversation
   * @param {'inbound'|'outbound'} message.direction - Message direction
   * @param {string} message.from - Sender phone number
   * @param {string} message.to - Recipient phone number
   * @param {string} message.body - Message content
   * @param {string[]} [message.mediaUrls] - Array of media URLs (for MMS)
   * @param {string} message.status - Initial status
   * @param {string} [message.errorCode] - Error code (if failed)
   * @param {string} [message.errorMessage] - Error message (if failed)
   * @param {Date} [message.timestamp] - Optional custom timestamp
   * @returns {Message} The stored message with timestamp
   *
   * @example
   * const message = messageStore.create({
   *   messageSid: 'SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
   *   conversationId: '550e8400-e29b-41d4-a716-446655440000',
   *   direction: 'outbound',
   *   from: '+1987654321',
   *   to: '+1234567890',
   *   body: 'Hello!',
   *   status: 'queued',
   * });
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
   * Get message by SID.
   *
   * @description
   * Retrieves a single message by its Twilio SID.
   *
   * @param {string} messageSid - Twilio message SID
   * @returns {Message | null} The message or null if not found
   *
   * @example
   * const message = messageStore.getBySid('SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
   * if (message) {
   *   console.log('Status:', message.status);
   * }
   */
  getBySid(messageSid: string): Message | null {
    const stmt = this.db.prepare('SELECT * FROM messages WHERE message_sid = ?');
    const row = stmt.get(messageSid) as any;
    return row ? this.rowToMessage(row) : null;
  }

  /**
   * Get all messages for a conversation.
   *
   * @description
   * Retrieves all messages in a conversation, ordered chronologically
   * (oldest first).
   *
   * @param {string} conversationId - UUID of the conversation
   * @param {number} [limit=100] - Maximum messages to return
   * @returns {Message[]} Array of messages in chronological order
   *
   * @example
   * const messages = messageStore.getByConversation('550e8400-e29b-41d4-a716-446655440000');
   * messages.forEach(msg => console.log(`${msg.direction}: ${msg.body}`));
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
   * Query messages with filters.
   *
   * @description
   * Flexible message query supporting multiple optional filters.
   * Results are ordered by timestamp descending (newest first).
   *
   * @param {Object} params - Query parameters
   * @param {string} [params.from] - Filter by sender phone number
   * @param {string} [params.to] - Filter by recipient phone number
   * @param {string} [params.conversationId] - Filter by conversation UUID
   * @param {Date} [params.since] - Filter messages after this date
   * @param {number} [params.limit=50] - Maximum messages to return
   * @returns {Message[]} Array of matching messages (newest first)
   *
   * @example
   * // Get recent messages from a specific sender
   * const messages = messageStore.query({
   *   from: '+1234567890',
   *   limit: 10,
   * });
   *
   * @example
   * // Get messages in the last hour
   * const messages = messageStore.query({
   *   since: new Date(Date.now() - 60 * 60 * 1000),
   * });
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
   * Update message status.
   *
   * @description
   * Updates the delivery status of a message. Called when receiving
   * status callbacks from Twilio webhooks.
   *
   * @param {string} messageSid - Twilio message SID
   * @param {string} status - New status value
   * @param {string} [errorCode] - Error code (for failed/undelivered)
   * @param {string} [errorMessage] - Error description
   * @returns {void}
   *
   * @example
   * // Update to delivered
   * messageStore.updateStatus('SMxxxxx', 'delivered');
   *
   * @example
   * // Update failed message
   * messageStore.updateStatus('SMxxxxx', 'failed', '30003', 'Unreachable destination');
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
   * Get message count for a conversation.
   *
   * @description
   * Returns the total number of messages in a conversation.
   * Useful for summary/context information.
   *
   * @param {string} conversationId - UUID of the conversation
   * @returns {number} Total message count
   *
   * @example
   * const count = messageStore.getConversationMessageCount('550e8400-e29b-41d4-a716-446655440000');
   * console.log(`Conversation has ${count} messages`);
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
   * Convert database row to Message object.
   *
   * @description
   * Transforms a raw SQLite row into a typed Message object,
   * parsing JSON fields and converting timestamps.
   *
   * @private
   * @param {any} row - Raw database row
   * @returns {Message} Typed message object
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
   * Close database connection.
   *
   * @description
   * Closes the SQLite database connection. Should be called when
   * the application is shutting down to ensure clean cleanup.
   *
   * @returns {void}
   *
   * @example
   * // On application shutdown
   * messageStore.close();
   */
  close(): void {
    this.db.close();
  }
}

/**
 * Singleton instance of MessageStore for use throughout the application.
 *
 * @description
 * Pre-initialized MessageStore instance that should be used for all
 * message operations. Using a singleton ensures data consistency
 * and proper database connection management.
 *
 * @constant
 * @type {MessageStore}
 *
 * @example
 * import { messageStore } from './storage/message-store.js';
 *
 * // Store a message
 * messageStore.create({ ... });
 *
 * // Query messages
 * const msgs = messageStore.query({ from: '+1234567890' });
 */
export const messageStore = new MessageStore();
