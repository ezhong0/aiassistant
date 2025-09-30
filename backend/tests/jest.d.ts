/**
 * Jest Type Definitions for E2E Tests
 * Ensures Jest globals are available in test files
 */

/// <reference types="jest" />

declare global {
  const describe: jest.Describe;
  const it: jest.It;
  const test: jest.It;
  const expect: jest.Expect;
  const beforeAll: jest.Lifecycle;
  const beforeEach: jest.Lifecycle;
  const afterAll: jest.Lifecycle;
  const afterEach: jest.Lifecycle;
  const jest: typeof import('jest');
}

export {};
