/**
 * Tests for get_conversation_thread MCP tool
 * Tests validation schema
 */

import { z } from 'zod';

// Define the schema directly for testing (mirrors the actual implementation)
const getConversationThreadSchema = z.object({
  conversationId: z.string().uuid(),
  includeContext: z.boolean().default(false),
});

describe('get_conversation_thread schema validation', () => {
  describe('conversationId field', () => {
    it('should accept valid UUID v4', () => {
      const result = getConversationThreadSchema.safeParse({
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should accept UUID with uppercase letters', () => {
      const result = getConversationThreadSchema.safeParse({
        conversationId: '550E8400-E29B-41D4-A716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = getConversationThreadSchema.safeParse({
        conversationId: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('should reject UUID without dashes', () => {
      const result = getConversationThreadSchema.safeParse({
        conversationId: '550e8400e29b41d4a716446655440000',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty string', () => {
      const result = getConversationThreadSchema.safeParse({
        conversationId: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing conversationId', () => {
      const result = getConversationThreadSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('includeContext field', () => {
    it('should default to false', () => {
      const result = getConversationThreadSchema.parse({
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.includeContext).toBe(false);
    });

    it('should accept true', () => {
      const result = getConversationThreadSchema.parse({
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        includeContext: true,
      });
      expect(result.includeContext).toBe(true);
    });

    it('should accept false explicitly', () => {
      const result = getConversationThreadSchema.parse({
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        includeContext: false,
      });
      expect(result.includeContext).toBe(false);
    });
  });
});
