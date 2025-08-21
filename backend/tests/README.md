# Tests Directory

This directory contains test files and configuration validation scripts for the assistant application.

## Files

- **test-config-refactor.ts** - Validates configuration refactoring and centralized config files
- **test-master-agent.ts** - Tests Master Agent routing logic and tool selection
- **test-openai-integration.ts** - Tests OpenAI integration functionality
- **test-comprehensive.ts** - Comprehensive system tests
- **test-contact-agent.ts** - Tests contact agent functionality
- **test-contact-integration.ts** - Tests contact integration workflows

## Usage

Run tests using npm scripts:

```bash
npm run test:master
npm run test:openai
npm run test:comprehensive
npm run test:contact
npm run test:contact-integration
```

Or run directly with ts-node:

```bash
npx ts-node tests/test-config-refactor.ts
```