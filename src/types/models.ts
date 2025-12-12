/**
 * Type definitions for data models
 */

export interface Conversation {
  id: string;
  participants: string[];
  createdAt: Date;
  lastActivity: Date;
  metadata: Record<string, any>;
  status: 'active' | 'archived';
}

export interface Message {
  messageSid: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  from: string;
  to: string;
  body: string;
  mediaUrls?: string[];
  timestamp: Date;
  status: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface ConversationContext {
  conversationId: string;
  summary: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  keyTopics: string[];
  nextActions?: string[];
  lastUpdated: Date;
}
