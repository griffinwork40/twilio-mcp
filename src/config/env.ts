/**
 * @fileoverview Environment configuration with Zod validation
 *
 * This module validates and exports environment variables for the Twilio MCP server.
 * All configuration is validated at startup using Zod schemas, ensuring type safety
 * and providing clear error messages for missing or invalid configuration.
 *
 * @module config/env
 * @author Twilio MCP Team
 * @license MIT
 */

import { z } from 'zod';

/**
 * Zod schema for validating environment configuration.
 *
 * @description
 * Defines the expected structure and validation rules for all environment variables:
 *
 * **Required Variables:**
 * - `TWILIO_ACCOUNT_SID` - Must start with "AC"
 * - `TWILIO_AUTH_TOKEN` - Minimum 32 characters
 * - `TWILIO_PHONE_NUMBER` - E.164 format (+1234567890)
 * - `WEBHOOK_BASE_URL` - Valid URL for webhook callbacks
 *
 * **Optional Variables (with defaults):**
 * - `WEBHOOK_PORT` - 1-65535, defaults to 3000
 * - `DATABASE_PATH` - Defaults to "./data/twilio.db"
 * - `LOG_LEVEL` - debug/info/warn/error, defaults to "info"
 * - `AUTO_CREATE_CONVERSATIONS` - Boolean, defaults to true
 * - `ENABLE_AI_CONTEXT` - Boolean, defaults to true
 * - `ENABLE_MMS` - Boolean, defaults to true
 *
 * @constant
 * @type {z.ZodObject}
 */
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

/**
 * TypeScript type inferred from the environment schema.
 *
 * @description
 * This type represents the validated configuration object with all
 * environment variables properly typed.
 *
 * @typedef {Object} EnvConfig
 * @property {string} TWILIO_ACCOUNT_SID - Twilio Account SID (starts with "AC")
 * @property {string} TWILIO_AUTH_TOKEN - Twilio Auth Token (32+ chars)
 * @property {string} TWILIO_PHONE_NUMBER - Twilio phone number in E.164 format
 * @property {number} WEBHOOK_PORT - Port for webhook server (1-65535)
 * @property {string} WEBHOOK_BASE_URL - Base URL for webhook endpoints
 * @property {string} DATABASE_PATH - Path to SQLite database file
 * @property {'debug'|'info'|'warn'|'error'} LOG_LEVEL - Logging level
 * @property {boolean} AUTO_CREATE_CONVERSATIONS - Auto-create conversation threads
 * @property {boolean} ENABLE_AI_CONTEXT - Enable AI context generation
 * @property {boolean} ENABLE_MMS - Enable MMS support
 */
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables.
 *
 * @description
 * Validates all environment variables against the Zod schema.
 * If validation fails, logs detailed error messages and exits the process.
 *
 * @returns {EnvConfig} Validated configuration object
 * @throws {never} Process exits with code 1 if validation fails
 *
 * @example
 * // Environment variables are validated automatically on import
 * import { config } from './config/env.js';
 *
 * // Access validated configuration
 * console.log(config.TWILIO_ACCOUNT_SID);
 * console.log(config.WEBHOOK_PORT); // number, not string
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

/**
 * Validated environment configuration singleton.
 *
 * @description
 * Exported configuration object containing all validated environment variables.
 * This object is created once at module load and provides type-safe access
 * to all configuration values.
 *
 * @constant
 * @type {EnvConfig}
 *
 * @example
 * import { config } from './config/env.js';
 *
 * // Use in Twilio client initialization
 * const client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
 *
 * // Use in webhook server
 * app.listen(config.WEBHOOK_PORT);
 */
export const config = validateEnv();
