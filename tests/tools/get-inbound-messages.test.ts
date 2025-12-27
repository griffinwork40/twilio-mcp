/**
 * Tests for get_inbound_messages MCP tool
 * Tests validation schema
 */

import { z } from 'zod';

// Define the schema directly for testing (mirrors the actual implementation)
const getInboundMessagesSchema = z.object({
  from: z.string().regex(/^\+[1-9]\d{1,14}$/).optional(),
  to: z.string().regex(/^\+[1-9]\d{1,14}$/).optional(),
  conversationId: z.string().uuid().optional(),
  since: z.string().datetime().optional(),
  limit: z.number().min(1).max(1000).default(50),
});

describe('get_inbound_messages schema validation', () => {
  describe('from field', () => {
    it('should accept valid E.164 phone number', () => {
      const result = getInboundMessagesSchema.safeParse({
        from: '+15559876543',
      });
      expect(result.success).toBe(true);
    });

    it('should work without from field', () => {
      const result = getInboundMessagesSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject invalid phone number', () => {
      const result = getInboundMessagesSchema.safeParse({
        from: '5559876543',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('to field', () => {
    it('should accept valid E.164 phone number', () => {
      const result = getInboundMessagesSchema.safeParse({
        to: '+15551234567',
      });
      expect(result.success).toBe(true);
    });

    it('should work without to field', () => {
      const result = getInboundMessagesSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject invalid phone number', () => {
      const result = getInboundMessagesSchema.safeParse({
        to: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('conversationId field', () => {
    it('should accept valid UUID', () => {
      const result = getInboundMessagesSchema.safeParse({
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should work without conversationId', () => {
      const result = getInboundMessagesSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = getInboundMessagesSchema.safeParse({
        conversationId: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('since field', () => {
    it('should accept valid ISO datetime with Z suffix', () => {
      const result = getInboundMessagesSchema.safeParse({
        since: '2025-01-15T10:00:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('should work without since field', () => {
      const result = getInboundMessagesSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject date without time', () => {
      const result = getInboundMessagesSchema.safeParse({
        since: '2025-01-15',
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-ISO datetime', () => {
      const result = getInboundMessagesSchema.safeParse({
        since: 'January 15, 2025',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid datetime string', () => {
      const result = getInboundMessagesSchema.safeParse({
        since: 'not-a-date',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('limit field', () => {
    it('should default to 50', () => {
      const result = getInboundMessagesSchema.parse({});
      expect(result.limit).toBe(50);
    });

    it('should accept minimum value of 1', () => {
      const result = getInboundMessagesSchema.safeParse({ limit: 1 });
      expect(result.success).toBe(true);
    });

    it('should accept maximum value of 1000', () => {
      const result = getInboundMessagesSchema.safeParse({ limit: 1000 });
      expect(result.success).toBe(true);
    });

    it('should reject value below minimum', () => {
      const result = getInboundMessagesSchema.safeParse({ limit: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject value above maximum', () => {
      const result = getInboundMessagesSchema.safeParse({ limit: 1001 });
      expect(result.success).toBe(false);
    });

    it('should accept value in range', () => {
      const result = getInboundMessagesSchema.parse({ limit: 100 });
      expect(result.limit).toBe(100);
    });
  });

  describe('combined filters', () => {
    it('should accept all filters together', () => {
      const result = getInboundMessagesSchema.safeParse({
        from: '+15559876543',
        to: '+15551234567',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        since: '2025-01-15T10:00:00Z',
        limit: 100,
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty object with defaults', () => {
      const result = getInboundMessagesSchema.parse({});
      expect(result.limit).toBe(50);
      expect(result.from).toBeUndefined();
      expect(result.to).toBeUndefined();
      expect(result.conversationId).toBeUndefined();
      expect(result.since).toBeUndefined();
    });
  });
});
