/**
 * Tests for send_sms MCP tool
 * Tests validation schema and edge cases
 */

import { z } from 'zod';

// Define the schema directly for testing (mirrors the actual implementation)
const sendSmsSchema = z.object({
  to: z.string().regex(
    /^\+[1-9]\d{1,14}$/,
    'Phone number must be in E.164 format (+1234567890)'
  ),
  message: z.string().min(1).max(1600, 'Message must be between 1 and 1600 characters'),
  from: z.string().regex(/^\+[1-9]\d{1,14}$/).optional(),
  conversationId: z.string().uuid().optional(),
});

describe('send_sms schema validation', () => {
  describe('to field', () => {
    it('should accept valid E.164 phone number', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'Hello!',
      });
      expect(result.success).toBe(true);
    });

    it('should accept international phone numbers', () => {
      const result = sendSmsSchema.safeParse({
        to: '+447911123456',
        message: 'Hello!',
      });
      expect(result.success).toBe(true);
    });

    it('should reject phone number without + prefix', () => {
      const result = sendSmsSchema.safeParse({
        to: '5559876543',
        message: 'Hello!',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('E.164 format');
      }
    });

    it('should reject phone number starting with +0', () => {
      const result = sendSmsSchema.safeParse({
        to: '+05559876543',
        message: 'Hello!',
      });
      expect(result.success).toBe(false);
    });

    it('should reject phone number with dashes', () => {
      const result = sendSmsSchema.safeParse({
        to: '+1-555-987-6543',
        message: 'Hello!',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty phone number', () => {
      const result = sendSmsSchema.safeParse({
        to: '',
        message: 'Hello!',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('message field', () => {
    it('should accept valid message', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'Hello, this is a test message!',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty message', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: '',
      });
      expect(result.success).toBe(false);
    });

    it('should accept message at maximum length (1600 chars)', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'a'.repeat(1600),
      });
      expect(result.success).toBe(true);
    });

    it('should reject message over 1600 characters', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'a'.repeat(1601),
      });
      expect(result.success).toBe(false);
    });

    it('should accept message with unicode characters', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'Hello! 👋 How are you? 你好',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('from field (optional)', () => {
    it('should accept valid from number', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'Hello!',
        from: '+15551234567',
      });
      expect(result.success).toBe(true);
    });

    it('should work without from number', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'Hello!',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.from).toBeUndefined();
      }
    });

    it('should reject invalid from number format', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'Hello!',
        from: '5551234567',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('conversationId field (optional)', () => {
    it('should accept valid UUID', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'Hello!',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should work without conversationId', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'Hello!',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'Hello!',
        conversationId: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('should reject UUID-like string with wrong format', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'Hello!',
        conversationId: '550e8400e29b41d4a716446655440000', // Missing dashes
      });
      expect(result.success).toBe(false);
    });
  });

  describe('combined validation', () => {
    it('should accept all valid fields', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        message: 'Hello!',
        from: '+15551234567',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const result = sendSmsSchema.safeParse({
        to: '+15559876543',
        // missing message
      });
      expect(result.success).toBe(false);
    });

    it('should reject completely empty object', () => {
      const result = sendSmsSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
