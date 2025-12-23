/**
 * Tests for TwilioClient service
 * Tests the TwilioClient class instantiation and method signatures
 */

import { TwilioClient } from '../../src/services/twilio-client.js';

describe('TwilioClient', () => {
  let client: TwilioClient;

  beforeEach(() => {
    client = new TwilioClient();
  });

  describe('constructor', () => {
    it('should create a TwilioClient instance', () => {
      expect(client).toBeInstanceOf(TwilioClient);
    });
  });

  describe('method existence', () => {
    it('should have sendSms method', () => {
      expect(typeof client.sendSms).toBe('function');
    });

    it('should have sendMms method', () => {
      expect(typeof client.sendMms).toBe('function');
    });

    it('should have getMessage method', () => {
      expect(typeof client.getMessage).toBe('function');
    });

    it('should have listMessages method', () => {
      expect(typeof client.listMessages).toBe('function');
    });

    it('should have validateWebhookSignature method', () => {
      expect(typeof client.validateWebhookSignature).toBe('function');
    });
  });

  describe('validateWebhookSignature', () => {
    it('should return boolean for signature validation', () => {
      // With invalid credentials, validation should fail
      const result = client.validateWebhookSignature(
        'some-signature',
        'https://example.com/webhook',
        { test: 'data' }
      );
      expect(typeof result).toBe('boolean');
    });

    it('should reject empty signature', () => {
      const result = client.validateWebhookSignature(
        '',
        'https://example.com/webhook',
        {}
      );
      expect(result).toBe(false);
    });
  });
});
