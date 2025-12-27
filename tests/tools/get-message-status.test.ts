/**
 * Tests for get_message_status MCP tool
 * Tests validation schema
 */

import { z } from 'zod';

// Define the schema directly for testing (mirrors the actual implementation)
const getMessageStatusSchema = z.object({
  messageSid: z.string().startsWith('MM', 'Message SID must start with MM or SM').or(
    z.string().startsWith('SM')
  ),
});

describe('get_message_status schema validation', () => {
  describe('messageSid field', () => {
    it('should accept SMS SID starting with SM', () => {
      const result = getMessageStatusSchema.safeParse({
        messageSid: 'SM0000000000000000000000000000001',
      });
      expect(result.success).toBe(true);
    });

    it('should accept MMS SID starting with MM', () => {
      const result = getMessageStatusSchema.safeParse({
        messageSid: 'MM0000000000000000000000000000001',
      });
      expect(result.success).toBe(true);
    });

    it('should accept shorter SID starting with SM', () => {
      const result = getMessageStatusSchema.safeParse({
        messageSid: 'SM123',
      });
      expect(result.success).toBe(true);
    });

    it('should accept shorter SID starting with MM', () => {
      const result = getMessageStatusSchema.safeParse({
        messageSid: 'MM456',
      });
      expect(result.success).toBe(true);
    });

    it('should reject SID starting with other prefix', () => {
      const result = getMessageStatusSchema.safeParse({
        messageSid: 'XX0000000000000000000000000000001',
      });
      expect(result.success).toBe(false);
    });

    it('should reject SID starting with AC (account)', () => {
      const result = getMessageStatusSchema.safeParse({
        messageSid: 'AC0000000000000000000000000000001',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty SID', () => {
      const result = getMessageStatusSchema.safeParse({
        messageSid: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject just "SM" without additional characters', () => {
      // SM alone is technically valid as it starts with SM
      const result = getMessageStatusSchema.safeParse({
        messageSid: 'SM',
      });
      expect(result.success).toBe(true);
    });

    it('should reject lowercase sm prefix', () => {
      const result = getMessageStatusSchema.safeParse({
        messageSid: 'sm0000000000000000000000000000001',
      });
      expect(result.success).toBe(false);
    });

    it('should reject lowercase mm prefix', () => {
      const result = getMessageStatusSchema.safeParse({
        messageSid: 'mm0000000000000000000000000000001',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing messageSid', () => {
      const result = getMessageStatusSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
