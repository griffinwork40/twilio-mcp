#!/usr/bin/env node
/**
 * Twilio MCP server entry point
 */

import { TwilioMcpServer } from './server.js';

async function main() {
  try {
    const server = new TwilioMcpServer();
    await server.start();
  } catch (error) {
    console.error('Failed to start Twilio MCP server:', error);
    process.exit(1);
  }
}

main();
