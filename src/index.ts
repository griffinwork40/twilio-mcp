#!/usr/bin/env node
/**
 * @fileoverview Twilio MCP server entry point
 *
 * This module serves as the main entry point for the Twilio MCP (Model Context Protocol)
 * server. It initializes and starts the MCP server which provides AI tools for SMS
 * messaging via Twilio's API.
 *
 * @module index
 * @author Twilio MCP Team
 * @license MIT
 */

import { TwilioMcpServer } from './server.js';

/**
 * Main application entry point.
 *
 * Initializes the Twilio MCP server and establishes stdio transport
 * for communication with AI clients (e.g., Claude Desktop).
 *
 * @description
 * This function creates a new instance of TwilioMcpServer and starts it.
 * If startup fails, it logs the error and exits with code 1.
 *
 * @returns {Promise<void>} Resolves when server is started successfully
 * @throws {Error} If server initialization or startup fails
 *
 * @example
 * // Run via npm script
 * // npm run dev
 *
 * @example
 * // Run directly with Node.js
 * // node dist/index.js
 */
async function main(): Promise<void> {
  try {
    const server = new TwilioMcpServer();
    await server.start();
  } catch (error) {
    console.error('Failed to start Twilio MCP server:', error);
    process.exit(1);
  }
}

main();
