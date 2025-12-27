/**
 * Jest test setup file
 * Sets up environment variables and global mocks for testing
 */

// Set up test environment variables before any imports
process.env.TWILIO_ACCOUNT_SID = 'ACtest12345678901234567890123456';
process.env.TWILIO_AUTH_TOKEN = 'test_auth_token_12345678901234567890';
process.env.TWILIO_PHONE_NUMBER = '+15551234567';
process.env.WEBHOOK_PORT = '3000';
process.env.WEBHOOK_BASE_URL = 'https://test.example.com';
process.env.DATABASE_PATH = ':memory:';
process.env.LOG_LEVEL = 'error';
process.env.AUTO_CREATE_CONVERSATIONS = 'true';
process.env.ENABLE_MMS = 'true';
process.env.ENABLE_AI_CONTEXT = 'true';

// Suppress console output during tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});
