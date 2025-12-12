/**
 * Environment configuration with Zod validation
 * Validates and exports environment variables for the Twilio MCP server
 */

import { z } from 'zod';

const envSchema = z.object({
  // Twilio Configuration
  TWILIO_ACCOUNT_SID: z.string().startsWith('AC', 'Account SID must start with AC'),
  TWILIO_AUTH_TOKEN: z.string().min(32, 'Auth token must be at least 32 characters'),
  TWILIO_PHONE_NUMBER: z.string().regex(
    /^\+[1-9]\d{1,14}$/,
    'Phone number must be in E.164 format (+1234567890)'
  ),

  // Webhook Server Configuration
  WEBHOOK_PORT: z.coerce.number().min(1).max(65535).default(3000),
  WEBHOOK_BASE_URL: z.string().url('Webhook base URL must be a valid URL'),

  // Database Configuration
  DATABASE_PATH: z.string().default('./data/twilio.db'),

  // Optional Configuration
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  AUTO_CREATE_CONVERSATIONS: z.coerce.boolean().default(true),
  ENABLE_AI_CONTEXT: z.coerce.boolean().default(true),
  ENABLE_MMS: z.coerce.boolean().default(true),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables
 */
function validateEnv(): EnvConfig {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}

export const config = validateEnv();
