/**
 * @fileoverview Type definitions for data models
 *
 * This module defines TypeScript interfaces for the core data models
 * used throughout the Twilio MCP server. These types ensure type safety
 * across storage, tools, and service layers.
 *
 * @module types/models
 * @author Twilio MCP Team
 * @license MIT
 */

/**
 * Conversation represents a threaded message exchange between participants.
 *
 * @description
 * A conversation groups related SMS/MMS messages together based on the
 * participant set. Messages between the same participants are automatically
 * linked to the same conversation for context tracking.
 *
 * Conversations are identified by their normalized participant key,
 * ensuring bidirectional matching (A→B and B→A map to the same conversation).
 *
 * @interface Conversation
 *
 * @example
 * // A typical conversation object
 * const conversation: Conversation = {
 *   id: '550e8400-e29b-41d4-a716-446655440000',
 *   participants: ['+1234567890', '+1987654321'],
 *   createdAt: new Date('2025-01-15T10:00:00Z'),
 *   lastActivity: new Date('2025-01-15T10:30:00Z'),
 *   metadata: { campaign: 'support' },
 *   status: 'active',
 * };
 */
export interface Conversation {
  /**
   * Unique identifier (UUID v4) for the conversation.
   * @type {string}
   */
  id: string;

  /**
   * Array of participant phone numbers in E.164 format.
   * Minimum of 2 participants required.
   * @type {string[]}
   * @example ['+1234567890', '+1987654321']
   */
  participants: string[];

  /**
   * Timestamp when the conversation was created.
   * @type {Date}
   */
  createdAt: Date;

  /**
   * Timestamp of the last message activity in the conversation.
   * Updated whenever a message is sent or received.
   * @type {Date}
   */
  lastActivity: Date;

  /**
   * Custom metadata attached to the conversation.
   * Can store arbitrary key-value pairs for tracking purposes.
   * @type {Record<string, any>}
   * @example { campaign: 'support', priority: 'high', ticketId: 'TICKET-123' }
   */
  metadata: Record<string, any>;

  /**
   * Current status of the conversation.
   * - 'active': Normal state, will match participant lookups
   * - 'archived': Closed/completed, won't match participant lookups
   * @type {'active' | 'archived'}
   */
  status: 'active' | 'archived';
}

/**
 * Message represents an individual SMS or MMS message.
 *
 * @description
 * A message is a single SMS or MMS transmission, either inbound (received)
 * or outbound (sent). Messages are linked to conversations and tracked
 * with Twilio's message SID for status updates.
 *
 * @interface Message
 *
 * @example
 * // An outbound SMS message
 * const message: Message = {
 *   messageSid: 'SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
 *   conversationId: '550e8400-e29b-41d4-a716-446655440000',
 *   direction: 'outbound',
 *   from: '+1987654321',
 *   to: '+1234567890',
 *   body: 'Hello from Twilio!',
 *   timestamp: new Date('2025-01-15T10:30:00Z'),
 *   status: 'delivered',
 * };
 *
 * @example
 * // An inbound MMS message with media
 * const mmsMessage: Message = {
 *   messageSid: 'MMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
 *   conversationId: '550e8400-e29b-41d4-a716-446655440000',
 *   direction: 'inbound',
 *   from: '+1234567890',
 *   to: '+1987654321',
 *   body: 'Check out this photo!',
 *   mediaUrls: ['https://api.twilio.com/xxx/Media/MMyyy'],
 *   timestamp: new Date('2025-01-15T10:31:00Z'),
 *   status: 'received',
 * };
 */
export interface Message {
  /**
   * Twilio message SID. SMS messages start with 'SM', MMS with 'MM'.
   * Used as the primary key for message storage.
   * @type {string}
   * @example 'SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
   */
  messageSid: string;

  /**
   * UUID of the conversation this message belongs to.
   * @type {string}
   */
  conversationId: string;

  /**
   * Direction of the message.
   * - 'inbound': Message received from external sender
   * - 'outbound': Message sent via the MCP server
   * @type {'inbound' | 'outbound'}
   */
  direction: 'inbound' | 'outbound';

  /**
   * Sender phone number in E.164 format.
   * @type {string}
   * @example '+1234567890'
   */
  from: string;

  /**
   * Recipient phone number in E.164 format.
   * @type {string}
   * @example '+1987654321'
   */
  to: string;

  /**
   * Message body/content text.
   * @type {string}
   */
  body: string;

  /**
   * Array of media URLs for MMS messages.
   * Only present for messages with media attachments.
   * @type {string[] | undefined}
   * @example ['https://api.twilio.com/xxx/Media/MMyyy']
   */
  mediaUrls?: string[];

  /**
   * Timestamp when the message was sent or received.
   * @type {Date}
   */
  timestamp: Date;

  /**
   * Current delivery status from Twilio.
   * Common values: 'queued', 'sending', 'sent', 'delivered',
   * 'undelivered', 'failed', 'received'
   * @type {string}
   * @see {@link https://www.twilio.com/docs/sms/api/message-resource#message-status-values|Twilio Message Status Values}
   */
  status: string;

  /**
   * Twilio error code for failed or undelivered messages.
   * Only present when status is 'failed' or 'undelivered'.
   * @type {string | undefined}
   * @example '30003'
   * @see {@link https://www.twilio.com/docs/api/errors|Twilio Error Codes}
   */
  errorCode?: string;

  /**
   * Human-readable error description.
   * Only present when status is 'failed' or 'undelivered'.
   * @type {string | undefined}
   * @example 'Unreachable destination handset'
   */
  errorMessage?: string;
}

/**
 * ConversationContext provides AI-friendly summary information.
 *
 * @description
 * This interface defines the structure for AI context summaries that
 * can be attached to conversations. Used to provide AI clients with
 * quick context without reading all messages.
 *
 * Note: This feature is reserved for future AI summarization capabilities.
 *
 * @interface ConversationContext
 *
 * @example
 * const context: ConversationContext = {
 *   conversationId: '550e8400-e29b-41d4-a716-446655440000',
 *   summary: 'Customer inquiry about order status. Issue resolved.',
 *   sentiment: 'positive',
 *   keyTopics: ['order status', 'shipping', 'tracking'],
 *   nextActions: ['Send follow-up survey'],
 *   lastUpdated: new Date('2025-01-15T10:30:00Z'),
 * };
 */
export interface ConversationContext {
  /**
   * UUID of the associated conversation.
   * @type {string}
   */
  conversationId: string;

  /**
   * Brief summary of the conversation content and outcome.
   * @type {string}
   */
  summary: string;

  /**
   * Overall sentiment analysis of the conversation.
   * @type {'positive' | 'neutral' | 'negative' | undefined}
   */
  sentiment?: 'positive' | 'neutral' | 'negative';

  /**
   * Array of key topics or themes discussed.
   * @type {string[]}
   */
  keyTopics: string[];

  /**
   * Suggested next actions based on conversation analysis.
   * @type {string[] | undefined}
   */
  nextActions?: string[];

  /**
   * Timestamp when the context was last updated.
   * @type {Date}
   */
  lastUpdated: Date;
}
