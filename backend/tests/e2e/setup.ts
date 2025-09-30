/**
 * E2E Test Setup
 * Loads environment variables and configures test environment
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env.test file for E2E testing (mock configs)
const envTestPath = path.resolve(__dirname, '../../.env.test');
dotenv.config({ path: envTestPath });

// Load .env file to override with real API keys for E2E testing
// This ensures we use real AI API but mocked external APIs
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath, override: true });

// Ensure E2E_TESTING flag is set
process.env.E2E_TESTING = 'true';

console.log('E2E test setup complete:', {
  envTestPath,
  envPath,
  hasOpenAIKey: !!process.env.OPENAI_API_KEY,
  openAIKeyPrefix: process.env.OPENAI_API_KEY?.substring(0, 10),
  nodeEnv: process.env.NODE_ENV
});