/**
 * Tests for create_conversation MCP tool
 * Tests validation schema
 */

import { z } from 'zod';

// Define the schema directly for testing (mirrors the actual implementation)
const createConversationSchema = z.object({
  participants: z.array(z.string().regex(/^\+[1-9]\d{1,14}$/)).min(2),
  metadata: z.record(z.any()).optional(),
});

describe('create_conversation schema validation', () => {
  describe('participants field', () => {
    it('should accept array with two participants', () => {
      const result = createConversationSchema.safeParse({
        participants: ['+15551234567', '+15559876543'],
      });
      expect(result.success).toBe(true);
    });

    it('should accept array with multiple participants', () => {
      const result = createConversationSchema.safeParse({
        participants: ['+15551234567', '+15559876543', '+15551111111', '+15552222222'],
      });
      expect(result.success).toBe(true);
    });

    it('should reject single participant', () => {
      const result = createConversationSchema.safeParse({
        participants: ['+15551234567'],
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty array', () => {
      const result = createConversationSchema.safeParse({
        participants: [],
      });
      expect(result.success).toBe(false);
    });

    it('should reject array with invalid phone number', () => {
      const result = createConversationSchema.safeParse({
        participants: ['+15551234567', 'invalid'],
      });
      expect(result.success).toBe(false);
    });

    it('should reject array with phone number missing +', () => {
      const result = createConversationSchema.safeParse({
        participants: ['+15551234567', '15559876543'],
      });
      expect(result.success).toBe(false);
    });

    it('should accept international phone numbers', () => {
      const result = createConversationSchema.safeParse({
        participants: ['+447911123456', '+33612345678'],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('metadata field (optional)', () => {
    it('should accept valid metadata object', () => {
      const result = createConversationSchema.safeParse({
        participants: ['+15551234567', '+15559876543'],
        metadata: { campaign: 'test', priority: 'high' },
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty metadata object', () => {
      const result = createConversationSchema.safeParse({
        participants: ['+15551234567', '+15559876543'],
        metadata: {},
      });
      expect(result.success).toBe(true);
    });

    it('should work without metadata', () => {
      const result = createConversationSchema.safeParse({
        participants: ['+15551234567', '+15559876543'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata).toBeUndefined();
      }
    });

    it('should accept nested metadata', () => {
      const result = createConversationSchema.safeParse({
        participants: ['+15551234567', '+15559876543'],
        metadata: {
          user: {
            name: 'John Doe',
            email: 'john@example.com',
          },
          tags: ['support', 'urgent'],
        },
      });
      expect(result.success).toBe(true);
    });

    it('should accept metadata with various types', () => {
      const result = createConversationSchema.safeParse({
        participants: ['+15551234567', '+15559876543'],
        metadata: {
          stringVal: 'test',
          numberVal: 42,
          boolVal: true,
          nullVal: null,
          arrayVal: [1, 2, 3],
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('missing fields', () => {
    it('should reject missing participants', () => {
      const result = createConversationSchema.safeParse({
        metadata: { test: 'data' },
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty object', () => {
      const result = createConversationSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
