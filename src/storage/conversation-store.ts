/**
 * Conversation storage implementation using SQLite
 * Manages conversation threads and their metadata
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';
import type { Conversation } from '../types/models.js';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

export class ConversationStore {
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
   * Create a new conversation
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
   * Find conversation by participants
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
   * Get conversation by ID
   */
  getById(id: string): Conversation | null {
    const stmt = this.db.prepare('SELECT * FROM conversations WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.rowToConversation(row) : null;
  }

  /**
   * Update conversation's last activity timestamp
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
   * Update conversation metadata
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
   * Archive a conversation
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
   * List all active conversations
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
   * Generate a normalized participants key for lookup
   */
  private getParticipantsKey(participants: string[]): string {
    return [...participants].sort().join('|');
  }

  /**
   * Convert database row to Conversation object
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
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

// Ensure data directory exists
async function ensureDataDirectory() {
  const dir = dirname(config.DATABASE_PATH);
  await mkdir(dir, { recursive: true });
}

// Initialize and export singleton
await ensureDataDirectory();
export const conversationStore = new ConversationStore();
