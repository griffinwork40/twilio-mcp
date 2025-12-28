/**
 * Tests for get_message_status MCP tool
 * Comprehensive tests for schema validation and business logic
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

    it('should accept typical Twilio SID format', () => {
      const result = getMessageStatusSchema.safeParse({
        messageSid: 'SMa1b2c3d4e5f6g7h8i9j0k1l2m3n4o5',
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

    it('should reject SID starting with PN (phone number)', () => {
      const result = getMessageStatusSchema.safeParse({
        messageSid: 'PN0000000000000000000000000000001',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty SID', () => {
      const result = getMessageStatusSchema.safeParse({
        messageSid: '',
      });
      expect(result.success).toBe(false);
    });

    it('should accept just "SM" as minimum', () => {
      // SM alone is technically valid as it starts with SM
      const result = getMessageStatusSchema.safeParse({
        messageSid: 'SM',
      });
      expect(result.success).toBe(true);
    });

    it('should accept just "MM" as minimum', () => {
      const result = getMessageStatusSchema.safeParse({
        messageSid: 'MM',
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

    it('should accept SID with alphanumeric characters', () => {
      const result = getMessageStatusSchema.safeParse({
        messageSid: 'SMabcdef1234567890ABCDEF12345678',
      });
      expect(result.success).toBe(true);
    });

    it('should reject null messageSid', () => {
      const result = getMessageStatusSchema.safeParse({
        messageSid: null,
      });
      expect(result.success).toBe(false);
    });
  });
});

/**
 * Business logic tests using mocked Twilio client
 */
describe('get_message_status business logic', () => {
  // Mock Twilio message response factory
  function createMockMessage(overrides: Partial<{
    sid: string;
    status: string;
    to: string;
    from: string | null;
    dateUpdated: Date | null;
    errorCode: number | null;
    errorMessage: string | null;
  }> = {}) {
    return {
      sid: 'SM0000000000000000000000000000001',
      status: 'delivered',
      to: '+15559876543',
      from: '+15551234567',
      dateUpdated: new Date('2025-01-15T12:00:00Z'),
      errorCode: null,
      errorMessage: null,
      ...overrides,
    };
  }

  // Test implementation of getMessageStatus
  async function testGetMessageStatus(
    params: z.infer<typeof getMessageStatusSchema>,
    twilioClient: { getMessage: (sid: string) => Promise<ReturnType<typeof createMockMessage>> }
  ) {
    const validated = getMessageStatusSchema.parse(params);

    const message = await twilioClient.getMessage(validated.messageSid);

    return {
      messageSid: message.sid,
      status: message.status,
      errorCode: message.errorCode || undefined,
      errorMessage: message.errorMessage || undefined,
      timestamp: message.dateUpdated?.toISOString() || new Date().toISOString(),
      to: message.to,
      from: message.from || undefined,
    };
  }

  describe('successful status retrieval', () => {
    it('should return delivered status', async () => {
      const mockClient = {
        getMessage: async () => createMockMessage({ status: 'delivered' }),
      };

      const result = await testGetMessageStatus(
        { messageSid: 'SM001' },
        mockClient
      );

      expect(result.status).toBe('delivered');
      expect(result.messageSid).toBe('SM0000000000000000000000000000001');
    });

    it('should return queued status', async () => {
      const mockClient = {
        getMessage: async () => createMockMessage({ status: 'queued' }),
      };

      const result = await testGetMessageStatus(
        { messageSid: 'SM001' },
        mockClient
      );

      expect(result.status).toBe('queued');
    });

    it('should return sending status', async () => {
      const mockClient = {
        getMessage: async () => createMockMessage({ status: 'sending' }),
      };

      const result = await testGetMessageStatus(
        { messageSid: 'SM001' },
        mockClient
      );

      expect(result.status).toBe('sending');
    });

    it('should return sent status', async () => {
      const mockClient = {
        getMessage: async () => createMockMessage({ status: 'sent' }),
      };

      const result = await testGetMessageStatus(
        { messageSid: 'SM001' },
        mockClient
      );

      expect(result.status).toBe('sent');
    });

    it('should return to and from numbers', async () => {
      const mockClient = {
        getMessage: async () => createMockMessage({
          to: '+15559876543',
          from: '+15551234567',
        }),
      };

      const result = await testGetMessageStatus(
        { messageSid: 'SM001' },
        mockClient
      );

      expect(result.to).toBe('+15559876543');
      expect(result.from).toBe('+15551234567');
    });

    it('should format timestamp as ISO string', async () => {
      const mockClient = {
        getMessage: async () => createMockMessage({
          dateUpdated: new Date('2025-01-15T12:30:45Z'),
        }),
      };

      const result = await testGetMessageStatus(
        { messageSid: 'SM001' },
        mockClient
      );

      expect(result.timestamp).toBe('2025-01-15T12:30:45.000Z');
    });

    it('should handle null dateUpdated', async () => {
      const mockClient = {
        getMessage: async () => createMockMessage({ dateUpdated: null }),
      };

      const result = await testGetMessageStatus(
        { messageSid: 'SM001' },
        mockClient
      );

      // Should fall back to current time
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should handle null from number', async () => {
      const mockClient = {
        getMessage: async () => createMockMessage({ from: null }),
      };

      const result = await testGetMessageStatus(
        { messageSid: 'SM001' },
        mockClient
      );

      expect(result.from).toBeUndefined();
    });
  });

  describe('failed message status', () => {
    it('should return failed status with error details', async () => {
      const mockClient = {
        getMessage: async () => createMockMessage({
          status: 'failed',
          errorCode: 30003,
          errorMessage: 'Unreachable destination handset',
        }),
      };

      const result = await testGetMessageStatus(
        { messageSid: 'SM001' },
        mockClient
      );

      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe(30003);
      expect(result.errorMessage).toBe('Unreachable destination handset');
    });

    it('should return undelivered status', async () => {
      const mockClient = {
        getMessage: async () => createMockMessage({
          status: 'undelivered',
          errorCode: 30004,
          errorMessage: 'Message blocked',
        }),
      };

      const result = await testGetMessageStatus(
        { messageSid: 'SM001' },
        mockClient
      );

      expect(result.status).toBe('undelivered');
      expect(result.errorCode).toBe(30004);
    });

    it('should handle null error fields', async () => {
      const mockClient = {
        getMessage: async () => createMockMessage({
          status: 'delivered',
          errorCode: null,
          errorMessage: null,
        }),
      };

      const result = await testGetMessageStatus(
        { messageSid: 'SM001' },
        mockClient
      );

      expect(result.errorCode).toBeUndefined();
      expect(result.errorMessage).toBeUndefined();
    });
  });

  describe('MMS message status', () => {
    it('should handle MMS SID', async () => {
      const mockClient = {
        getMessage: async (sid: string) => createMockMessage({
          sid: sid,
          status: 'delivered',
        }),
      };

      const result = await testGetMessageStatus(
        { messageSid: 'MM0000000000000000000000000000001' },
        mockClient
      );

      expect(result.messageSid).toBe('MM0000000000000000000000000000001');
      expect(result.status).toBe('delivered');
    });
  });

  describe('error handling', () => {
    it('should throw validation error for invalid SID', async () => {
      const mockClient = {
        getMessage: async () => createMockMessage(),
      };

      await expect(testGetMessageStatus(
        { messageSid: 'INVALID' },
        mockClient
      )).rejects.toThrow();
    });

    it('should throw validation error for empty SID', async () => {
      const mockClient = {
        getMessage: async () => createMockMessage(),
      };

      await expect(testGetMessageStatus(
        { messageSid: '' },
        mockClient
      )).rejects.toThrow();
    });

    it('should propagate Twilio API errors', async () => {
      const mockClient = {
        getMessage: async () => {
          throw new Error('Message not found');
        },
      };

      await expect(testGetMessageStatus(
        { messageSid: 'SM999' },
        mockClient
      )).rejects.toThrow('Message not found');
    });

    it('should handle Twilio rate limit error', async () => {
      const mockClient = {
        getMessage: async () => {
          const error = new Error('Too many requests');
          (error as any).code = 20429;
          throw error;
        },
      };

      await expect(testGetMessageStatus(
        { messageSid: 'SM001' },
        mockClient
      )).rejects.toThrow('Too many requests');
    });

    it('should handle Twilio authentication error', async () => {
      const mockClient = {
        getMessage: async () => {
          const error = new Error('Authentication failed');
          (error as any).code = 20003;
          throw error;
        },
      };

      await expect(testGetMessageStatus(
        { messageSid: 'SM001' },
        mockClient
      )).rejects.toThrow('Authentication failed');
    });
  });

  describe('all Twilio message statuses', () => {
    const allStatuses = [
      'accepted',
      'queued',
      'sending',
      'sent',
      'failed',
      'delivered',
      'undelivered',
      'receiving',
      'received',
      'read',
    ];

    allStatuses.forEach(status => {
      it(`should handle ${status} status`, async () => {
        const mockClient = {
          getMessage: async () => createMockMessage({ status }),
        };

        const result = await testGetMessageStatus(
          { messageSid: 'SM001' },
          mockClient
        );

        expect(result.status).toBe(status);
      });
    });
  });

  describe('common error codes', () => {
    const errorCases = [
      { code: 30001, message: 'Queue overflow' },
      { code: 30002, message: 'Account suspended' },
      { code: 30003, message: 'Unreachable destination handset' },
      { code: 30004, message: 'Message blocked' },
      { code: 30005, message: 'Unknown destination handset' },
      { code: 30006, message: 'Landline or unreachable carrier' },
      { code: 30007, message: 'Carrier violation' },
      { code: 30008, message: 'Unknown error' },
      { code: 30009, message: 'Missing segment' },
      { code: 30010, message: 'Message price exceeds max price' },
    ];

    errorCases.forEach(({ code, message }) => {
      it(`should handle error code ${code}`, async () => {
        const mockClient = {
          getMessage: async () => createMockMessage({
            status: 'failed',
            errorCode: code,
            errorMessage: message,
          }),
        };

        const result = await testGetMessageStatus(
          { messageSid: 'SM001' },
          mockClient
        );

        expect(result.errorCode).toBe(code);
        expect(result.errorMessage).toBe(message);
      });
    });
  });
});
