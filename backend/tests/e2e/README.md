# E2E Testing Infrastructure

Complete end-to-end testing framework for the AssistantApp with realistic mock data, comprehensive workflow testing, and beautiful HTML reports.

## 🏗️ Architecture Overview

The E2E testing infrastructure consists of 4 main components working together:

### 1. **WholeInboxGenerator** (`generators/whole-inbox-generator.ts`)
AI-powered realistic inbox data generation:
- Creates Gmail-compatible email data with proper MIME formatting
- Generates 4 user profiles: executive, manager, individual, mixed
- Supports email patterns: urgent, meeting, follow-up, newsletter, project, social
- Creates email threading and relationships
- Generates calendar events linked to emails

### 2. **UnifiedMockManager** (`mocks/unified-mock-manager.ts`)
API request interception and mock responses:
- Intercepts Google API (Gmail, Calendar, Contacts) and Slack API calls
- Returns mock data based on generated inbox
- Gmail query parser (supports `is:unread`, `from:`, `to:`, `subject:`, `label:`, `has:attachment`)
- Pagination support
- API call recording for analysis and reporting

### 3. **E2EHTMLReporter** (`reporters/html-reporter.ts`)
Beautiful HTML test reports:
- Inbox configuration and statistics
- Test results (pass/fail, execution time, tokens used)
- API call traces with timing information
- Sample emails from generated inbox
- Collapsible sections and interactive UI

### 4. **Test Suite** (`workflows/whole-inbox-e2e.test.ts`)
Comprehensive workflow testing:
- Executive workflows: urgent triage, meeting coordination, information gathering
- Manager workflows: team follow-ups, project status
- Individual workflows: task management, meeting prep
- Cross-domain workflows: email + calendar coordination
- Performance validation across different inbox sizes

## 📁 Directory Structure

```
e2e/
├── generators/              # AI-powered data generators
│   └── whole-inbox-generator.ts   # Inbox generation with AI
├── mocks/                   # API mocking infrastructure
│   └── unified-mock-manager.ts    # Request interception
├── reporters/               # Report generators
│   └── html-reporter.ts           # Beautiful HTML reports
├── workflows/               # Complete workflow tests
│   └── whole-inbox-e2e.test.ts    # Main test suite
├── reports/                 # Generated test reports
│   └── html/                      # HTML report outputs
├── data/                    # Test data templates (future)
├── evaluators/              # AI-powered evaluation (future)
└── README.md               # This file
```

## 🚀 Quick Start

### Prerequisites

1. **Environment Variables** - Create `.env` in backend directory:
   ```bash
   # AI Service (required for inbox generation)
   OPENAI_API_KEY=your-openai-api-key

   # Enable E2E testing mode
   E2E_TESTING=true
   ```

2. **Install Dependencies**:
   ```bash
   cd backend
   npm install
   ```

### Generate a New Inbox

Generate a realistic inbox with AI:

```bash
# Generate executive inbox (500 emails)
npm run e2e:generate-inbox executive

# Generate manager inbox (300 emails)
npm run e2e:generate-inbox manager

# Generate individual contributor inbox (150 emails)
npm run e2e:generate-inbox individual

# Save with custom filename
npm run e2e:generate-inbox executive my-custom-inbox.json
```

**Output:**
- Inbox saved to `tests/e2e/data/generated-inboxes/`
- Console shows summary and sample emails
- Takes 1-2 minutes to generate

### Test a Specific Command on an Inbox

Test a single command against a saved inbox:

```bash
# List available inboxes
npm run e2e:list-inboxes

# Test a command on a specific inbox
npm run e2e:test-command inbox-executive-1234.json "Show me urgent emails"

# Test with full path
npm run e2e:test-command tests/e2e/data/generated-inboxes/my-inbox.json "Find meetings about Q4"
```

**Output:**
- Full response from orchestrator
- Execution metrics (time, tokens, API calls)
- Layer breakdown (Layer 1/2/3 timing)
- HTML report automatically generated

### Run Full Test Suite

Run all workflow tests:

```bash
# Run all whole-inbox E2E tests
npm run test:whole-inbox

# Run with HTML report (opens in browser)
npm run test:whole-inbox:report
```

### Advanced Usage

#### Run specific test suites:
```bash
# Executive workflows only
npm run test:whole-inbox -- -t "Executive Inbox Workflows"

# Manager workflows only
npm run test:whole-inbox -- -t "Manager Inbox Workflows"

# Performance tests
npm run test:whole-inbox -- -t "Performance and Quality Validation"
```

#### Run with verbose output:
```bash
npm run test:whole-inbox -- --verbose
```

#### Watch mode for development:
```bash
E2E_TESTING=true node --max-old-space-size=2048 --expose-gc \
  node_modules/.bin/jest tests/e2e/workflows/whole-inbox-e2e.test.ts \
  --watch --runInBand --testTimeout=60000
```

## 📊 Test Output

Tests generate multiple outputs:

1. **Console Output**: Real-time test progress and results
2. **HTML Reports**: `tests/e2e/reports/html/`
   - Beautiful, interactive HTML reports
   - Inbox statistics
   - Test results with API call traces
   - Sample emails
   - Performance metrics

3. **API Call Records**: Captured during test execution
   - Request/response details
   - Timing information
   - Mock sources

## 🔧 How It Works

### Test Flow

1. **Initialization** (beforeAll):
   - Initialize AI services
   - Initialize mock manager
   - Configure Google API client with mock manager
   - Initialize 3-layer orchestrator

2. **Test Setup** (beforeEach):
   - Generate realistic inboxes for each user type

3. **Test Execution**:
   - Execute workflow using real orchestrator
   - Orchestrator → Layer 1 (Decomposition)
     → Layer 2 (Execution with mocked APIs)
     → Layer 3 (Synthesis)

4. **API Interception**:
   - GoogleAPIClient checks if mockManager is set
   - If yes: mockManager.interceptRequest()
   - Returns realistic data based on generated inbox

## 📝 Example Test

```typescript
it('should handle urgent email triage workflow', async () => {
  const userQuery = "Show me all urgent emails that need immediate attention";

  const result = await executeE2EWorkflow(
    userQuery,
    {
      inboxData: executiveInbox,
      userProfile: executiveInbox.metadata.userProfile
    },
    orchestrator,
    mockManager
  );

  // Assertions
  expect(result).toBeDefined();
  expect(result.response).toBeDefined();
  expect(result.executionTime).toBeLessThan(10000);

  // Verify API calls
  expect(result.apiCalls.length).toBeGreaterThan(0);

  // Verify response quality
  expect(result.response.toLowerCase()).toContain('urgent');
});
```

## 🎯 Available Test Scenarios

| Category | Test Name | Description |
|----------|-----------|-------------|
| **Executive** | Urgent email triage | Find and prioritize urgent emails |
| **Executive** | Meeting coordination | Track Q4 planning meeting status |
| **Executive** | Information gathering | Analyze project status across emails |
| **Manager** | Team follow-ups | Track unanswered team emails |
| **Manager** | Project status | Check blockers and issues |
| **Individual** | Task management | List this week's tasks |
| **Individual** | Meeting prep | Gather related emails for meeting |
| **Cross-Domain** | Email + Calendar | Coordinate meetings across both |
| **Performance** | Inbox size scaling | Test performance with different sizes |
| **Quality** | Content diversity | Validate realistic email generation |

## ⚙️ Configuration

### Inbox Templates

Customize templates in `generators/whole-inbox-generator.ts`:

```typescript
getExecutiveTemplate(): InboxTemplate {
  return {
    userProfile: {
      role: 'executive',
      industry: 'technology',
      communicationStyle: 'formal',
      urgencyLevel: 'high',
      emailVolume: 'high',
    },
    emailCount: 500,        // Adjust number
    emailPatterns: [
      {
        type: 'urgent',
        frequency: 0.3,      // 30% urgent emails
        characteristics: {
          responseTime: 'immediate',
          priority: 'high',
          // ...
        }
      }
    ]
  }
}
```

## 🔍 Troubleshooting

### Common Issues

**Tests timeout:**
```bash
npm run test:whole-inbox -- --testTimeout=120000
```

**Out of memory:**
```bash
E2E_TESTING=true node --max-old-space-size=4096 --expose-gc \
  node_modules/.bin/jest tests/e2e/workflows/whole-inbox-e2e.test.ts \
  --runInBand --testTimeout=60000
```

**AI generation fails:**
- Check `OPENAI_API_KEY` in `.env`
- Verify API credits
- Check OpenAI API status

**Mock manager not working:**
- Verify `E2E_TESTING=true` is set
- Check `googleClient.setMockManager()` is called
- Ensure mockManager is initialized

## 📈 Performance Benchmarks

Expected performance (MacBook Pro M1, 16GB RAM):

| Inbox Size | Emails | Avg Time | Memory |
|------------|--------|----------|--------|
| Individual | 150    | 3-6s     | ~500MB |
| Manager    | 300    | 5-9s     | ~800MB |
| Executive  | 500    | 8-14s    | ~1.2GB |

## 🎨 Design Patterns

### Strategy Pattern
- Location: `src/layers/layer2-execution/strategies/`
- Registry-based strategy selection
- Strategies: CrossReference, KeywordSearch, SemanticAnalysis

### Dependency Injection
- Services inject dependencies
- Mock manager injected into API clients
- AI services injected into generators

## 🛠️ Workflow Examples

### Example 1: Generate and Test

```bash
# Step 1: Generate an executive inbox
npm run e2e:generate-inbox executive

# Step 2: List available inboxes (note the filename)
npm run e2e:list-inboxes

# Step 3: Test various commands
npm run e2e:test-command inbox-executive-1234.json "Show me all urgent emails"
npm run e2e:test-command inbox-executive-1234.json "Find emails about meetings"
npm run e2e:test-command inbox-executive-1234.json "What projects need attention?"
```

### Example 2: Iterative Development

```bash
# Generate a test inbox once
npm run e2e:generate-inbox manager my-dev-inbox.json

# Test different query variations
npm run e2e:test-command my-dev-inbox.json "Show unread emails"
npm run e2e:test-command my-dev-inbox.json "Show me unread messages"
npm run e2e:test-command my-dev-inbox.json "What emails haven't I read?"

# Compare responses and iterate on your orchestrator
```

### Example 3: Performance Testing

```bash
# Generate different sized inboxes
npm run e2e:generate-inbox individual small-inbox.json
npm run e2e:generate-inbox manager medium-inbox.json
npm run e2e:generate-inbox executive large-inbox.json

# Test same query on different sizes
npm run e2e:test-command small-inbox.json "Show urgent emails"
npm run e2e:test-command medium-inbox.json "Show urgent emails"
npm run e2e:test-command large-inbox.json "Show urgent emails"

# Compare execution times
```

## 📝 Scripts Reference

| Script | Description | Usage |
|--------|-------------|-------|
| `e2e:generate-inbox` | Generate a new inbox | `npm run e2e:generate-inbox [role] [filename]` |
| `e2e:test-command` | Test command on inbox | `npm run e2e:test-command [inbox] [command]` |
| `e2e:list-inboxes` | List all saved inboxes | `npm run e2e:list-inboxes` |
| `test:whole-inbox` | Run full test suite | `npm run test:whole-inbox` |
| `test:whole-inbox:report` | Run tests + open report | `npm run test:whole-inbox:report` |

## 🤝 Contributing

When adding new E2E tests:

1. Follow existing test structure
2. Use `executeE2EWorkflow()` for consistency
3. Add assertions for response quality, timing, and API calls
4. Update this README with new scenarios

## 📚 Additional Resources

- **Helper Scripts**: `tests/e2e/scripts/`
  - `generate-inbox.ts` - Inbox generation
  - `test-command.ts` - Single command testing
  - `list-inboxes.ts` - List saved inboxes
- **Generated Inboxes**: `tests/e2e/data/generated-inboxes/`
- **HTML Reports**: `tests/e2e/reports/html/`