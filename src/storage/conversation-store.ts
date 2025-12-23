/**
 * @fileoverview Conversation storage implementation using SQLite
 *
 * This module provides persistent storage for conversation threads using SQLite.
 * Conversations represent multi-message exchanges between participants and are
 * automatically linked to SMS messages for context tracking.
 *
 * @module storage/conversation-store
 * @author Twilio MCP Team
 * @license MIT
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';
import type { Conversation } from '../types/models.js';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

/**
 * ConversationStore manages persistent storage of conversation threads.
 *
 * @description
 * This class provides CRUD operations for conversations using SQLite.
 * Key features:
 * - Participant-based lookup with normalized keys
 * - Metadata storage for custom attributes
 * - Activity tracking with timestamps
 * - Archival support for conversation lifecycle
 *
 * Conversations are identified by their participant set, allowing
 * bidirectional message matching (A→B and B→A map to same conversation).
 *
 * @example
 * // Using the singleton instance
 * import { conversationStore } from './storage/conversation-store.js';
 *
 * // Create a new conversation
 * const conv = conversationStore.create(['+1234567890', '+1987654321']);
 *
 * // Find by participants
 * const existing = conversationStore.findByParticipants(['+1987654321', '+1234567890']);
 *
 * // Update activity
 * conversationStore.updateLastActivity(conv.id);
 */
export class ConversationStore {
  /** @private SQLite database connection */
  private db: Database.Database;

  /**
   * Creates a new ConversationStore instance.
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
   * Creates the conversations table and indexes if they don't exist.
   * Schema includes:
   * - `id` - UUID primary key
   * - `participants` - Pipe-delimited sorted phone numbers
   * - `created_at` - Unix timestamp of creation
   * - `last_activity` - Unix timestamp of last message
   * - `metadata` - JSON string for custom data
   * - `status` - 'active' or 'archived'
   *
   * @private
   * @returns {void}
   */
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

  /**
   * Create a new conversation.
   *
   * @description
   * Creates a new conversation thread with the specified participants.
   * The conversation is assigned a new UUID and marked as 'active'.
   *
   * @param {string[]} participants - Array of phone numbers in E.164 format
   * @param {Record<string, any>} [metadata] - Optional custom metadata
   * @returns {Conversation} The created conversation object
   *
   * @example
   * const conversation = conversationStore.create(
   *   ['+1234567890', '+1987654321'],
   *   { campaign: 'support', priority: 'high' }
   * );
   * console.log('Created:', conversation.id);
   */
  create(participants: string[], metadata?: Record<string, any>): Conversation {
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
      status: 'active',
    };
  }

  /**
   * Find conversation by participants.
   *
   * @description
   * Looks up an active conversation by its participant set.
   * Participant order doesn't matter - [A, B] and [B, A] match the same conversation.
   *
   * @param {string[]} participants - Array of phone numbers to match
   * @returns {Conversation | null} The matching conversation or null if not found
   *
   * @example
   * // These both return the same conversation:
   * const conv1 = conversationStore.findByParticipants(['+1234567890', '+1987654321']);
   * const conv2 = conversationStore.findByParticipants(['+1987654321', '+1234567890']);
   */
  findByParticipants(participants: string[]): Conversation | null {
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

  /**
   * Get conversation by ID.
   *
   * @description
   * Retrieves a conversation by its UUID, regardless of status.
   *
   * @param {string} id - UUID of the conversation
   * @returns {Conversation | null} The conversation or null if not found
   *
   * @example
   * const conversation = conversationStore.getById('550e8400-e29b-41d4-a716-446655440000');
   * if (conversation) {
   *   console.log('Participants:', conversation.participants);
   * }
   */
  getById(id: string): Conversation | null {
    const stmt = this.db.prepare('SELECT * FROM conversations WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.rowToConversation(row) : null;
  }

  /**
   * Update conversation's last activity timestamp.
   *
   * @description
   * Updates the last_activity field to the current time.
   * Should be called whenever a new message is sent or received.
   *
   * @param {string} id - UUID of the conversation
   * @returns {void}
   *
   * @example
   * // After sending/receiving a message
   * conversationStore.updateLastActivity(conversationId);
   */
  updateLastActivity(id: string): void {
    const stmt = this.db.prepare(`
      UPDATE conversations
      SET last_activity = ?
      WHERE id = ?
    `);
    stmt.run(Date.now(), id);
  }

  /**
   * Update conversation metadata.
   *
   * @description
   * Replaces the conversation's metadata with new values.
   * To merge with existing metadata, first retrieve the conversation,
   * modify the metadata, then call this method.
   *
   * @param {string} id - UUID of the conversation
   * @param {Record<string, any>} metadata - New metadata object
   * @returns {void}
   *
   * @example
   * // Update metadata
   * conversationStore.updateMetadata(conversationId, {
   *   status: 'resolved',
   *   resolvedBy: 'agent-123',
   * });
   */
  updateMetadata(id: string, metadata: Record<string, any>): void {
    const stmt = this.db.prepare(`
      UPDATE conversations
      SET metadata = ?
      WHERE id = ?
    `);
    stmt.run(JSON.stringify(metadata), id);
  }

  /**
   * Archive a conversation.
   *
   * @description
   * Marks a conversation as archived. Archived conversations won't be
   * returned by findByParticipants but can still be retrieved by ID.
   *
   * @param {string} id - UUID of the conversation to archive
   * @returns {void}
   *
   * @example
   * // Archive a completed conversation
   * conversationStore.archive(conversationId);
   */
  archive(id: string): void {
    const stmt = this.db.prepare(`
      UPDATE conversations
      SET status = 'archived'
      WHERE id = ?
    `);
    stmt.run(id);
  }

  /**
   * List all active conversations.
   *
   * @description
   * Returns active conversations sorted by last activity (most recent first).
   *
   * @param {number} [limit=50] - Maximum number of conversations to return
   * @returns {Conversation[]} Array of active conversations
   *
   * @example
   * // Get most recent 10 active conversations
   * const conversations = conversationStore.listActive(10);
   */
  listActive(limit: number = 50): Conversation[] {
    const stmt = this.db.prepare(`
      SELECT * FROM conversations
      WHERE status = 'active'
      ORDER BY last_activity DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];
    return rows.map(row => this.rowToConversation(row));
  }

  /**
   * Generate a normalized participants key for lookup.
   *
   * @description
   * Creates a deterministic key from participant list by sorting phone numbers
   * alphabetically and joining with pipe character. This ensures
   * [A, B] and [B, A] produce the same key.
   *
   * @private
   * @param {string[]} participants - Array of phone numbers
   * @returns {string} Normalized key (e.g., "+1234567890|+1987654321")
   *
   * @example
   * // Both produce "+1234567890|+1987654321"
   * getParticipantsKey(['+1987654321', '+1234567890'])
   * getParticipantsKey(['+1234567890', '+1987654321'])
   */
  private getParticipantsKey(participants: string[]): string {
    return [...participants].sort().join('|');
  }

  /**
   * Convert database row to Conversation object.
   *
   * @description
   * Transforms a raw SQLite row into a typed Conversation object,
   * parsing JSON fields and converting timestamps.
   *
   * @private
   * @param {any} row - Raw database row
   * @returns {Conversation} Typed conversation object
   */
  private rowToConversation(row: any): Conversation {
    return {
      id: row.id,
      participants: row.participants.split('|'),
      createdAt: new Date(row.created_at),
      lastActivity: new Date(row.last_activity),
      metadata: JSON.parse(row.metadata || '{}'),
      status: row.status,
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
   * conversationStore.close();
   */
  close(): void {
    this.db.close();
  }
}

/**
 * Ensure the data directory exists before creating the database.
 *
 * @description
 * Creates the parent directory for the database file if it doesn't exist.
 * This is called automatically during module initialization.
 *
 * @private
 * @returns {Promise<void>}
 */
async function ensureDataDirectory(): Promise<void> {
  const dir = dirname(config.DATABASE_PATH);
  await mkdir(dir, { recursive: true });
}

// Initialize and export singleton
await ensureDataDirectory();

/**
 * Singleton instance of ConversationStore for use throughout the application.
 *
 * @description
 * Pre-initialized ConversationStore instance that should be used for all
 * conversation operations. Using a singleton ensures data consistency
 * and proper database connection management.
 *
 * @constant
 * @type {ConversationStore}
 *
 * @example
 * import { conversationStore } from './storage/conversation-store.js';
 *
 * // Create a conversation
 * const conv = conversationStore.create(['+1234567890', '+1987654321']);
 */
export const conversationStore = new ConversationStore();
