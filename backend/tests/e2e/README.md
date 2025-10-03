# E2E Testing Framework

This directory contains the end-to-end testing framework for the AI-powered assistant application.

## Structure

```
e2e/
├── data/                    # Test data and inbox templates
│   └── inbox-templates/     # Whole inbox templates
├── generators/              # AI-powered data generators
│   └── whole-inbox-generator.ts
├── mocks/                   # API mocking infrastructure
│   └── unified-mock-manager.ts
├── workflows/               # Complete workflow tests
│   └── whole-inbox-e2e.test.ts
├── evaluators/              # AI-powered evaluation (future)
├── scenarios/               # Specific scenario tests (future)
├── reports/                 # Test reports and analytics (future)
└── README.md               # This file
```

## Quick Start

1. **Generate a complete inbox**:
   ```typescript
   const inboxGenerator = new WholeInboxGenerator(aiService);
   const inboxData = await inboxGenerator.generateCompleteInbox(template);
   ```

2. **Setup API mocking**:
   ```typescript
   const mockManager = UnifiedMockManager.getInstance();
   await mockManager.setupMockContext(inboxData, userProfile);
   ```

3. **Run E2E tests**:
   ```bash
   npm run test:e2e
   ```

## Features

- **Whole Inbox Generation**: Create realistic inboxes with hundreds of emails
- **User Profile Templates**: Executive, Manager, Individual contributor inboxes
- **API Mocking**: Complete Gmail, Calendar, Slack API mocking
- **Workflow Testing**: Test complete user journeys end-to-end
- **Performance Validation**: Ensure consistent performance across scenarios

## Available Templates

- **Executive**: 500 emails, high urgency, formal communication
- **Manager**: 300 emails, medium urgency, mixed communication
- **Individual**: 150 emails, low urgency, casual communication

See the main README.md for detailed usage instructions.