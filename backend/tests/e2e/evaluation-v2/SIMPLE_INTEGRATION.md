# Simple Integration: E2E Testing + 3-Layer Orchestrator

## 🎯 **The Right Way to Integrate**

The e2e testing system **already exists** and works perfectly! You just need to replace the mock `yourChatbotFunction` with a call to your real orchestrator.

## 🔧 **Step 1: Replace the Mock Function**

In `backend/tests/e2e/evaluation-v2/example.ts`, replace the existing `yourChatbotFunction`:

```typescript
// REPLACE THIS (lines 20-74):
async function yourChatbotFunction(
  inbox: GeneratedInbox,
  query: string
): Promise<ChatbotResponse> {
  console.log(`      [Mock Chatbot] Processing: "${query}"`);
  
  // ... existing mock implementation
}

// WITH THIS:
async function yourChatbotFunction(
  inbox: GeneratedInbox,
  query: string
): Promise<ChatbotResponse> {
  console.log(`      [Real Orchestrator] Processing: "${query}"`);
  
  try {
    // Create DI container for testing
    const container = createAppContainer();
    const orchestrator = container.resolve('orchestrator');
    
    // Process query through your real orchestrator
    const result = await orchestrator.processUserInput(
      query,
      'test-user-123', // Test user ID
      [], // Empty conversation history
      undefined // No previous state
    );
    
    // Convert orchestrator result to ChatbotResponse format
    return convertOrchestratorResult(result, inbox, query);
    
  } catch (error) {
    console.error(`      [Error] ${error.message}`);
    
    // Return error response
    return {
      type: 'email_list',
      emailIds: [],
      presentation: `Error: ${error.message}`,
      internalState: {
        error: error.message,
        processingTime: 0,
      },
    };
  }
}
```

## 🔧 **Step 2: Add Helper Function**

Add this helper function to convert orchestrator results:

```typescript
/**
 * Convert orchestrator result to ChatbotResponse format
 */
function convertOrchestratorResult(
  result: any,
  inbox: GeneratedInbox,
  query: string
): ChatbotResponse {
  // Extract email IDs from orchestrator result
  const emailIds = extractEmailIds(result, inbox);
  
  // Determine response type
  const responseType = determineResponseType(result, query);
  
  // Build ranking
  const ranking = emailIds.map(emailId => {
    const email = inbox.emails.find(e => e.id === emailId);
    return {
      emailId,
      score: email ? calculateEmailScore(email) : 0,
    };
  }).sort((a, b) => b.score - a.score);
  
  return {
    type: responseType,
    emailIds: emailIds.length > 0 ? emailIds : undefined,
    summary: responseType === 'summary' ? result.message : undefined,
    ranking,
    presentation: result.message,
    
    // Expose orchestrator internal state
    internalState: {
      orchestratorResult: result,
      processingTime: result.metadata?.processingTime || 0,
      executionGraph: result.masterState?.executionGraph,
      executionResults: result.masterState?.executionResults,
    },
  };
}

/**
 * Extract email IDs from orchestrator result
 */
function extractEmailIds(result: any, inbox: GeneratedInbox): string[] {
  const emailIds: string[] = [];
  
  // Look for email IDs in execution results
  if (result.masterState?.executionResults?.nodeResults) {
    for (const [nodeId, nodeResult] of result.masterState.executionResults.nodeResults) {
      if (nodeResult.data?.emails) {
        emailIds.push(...nodeResult.data.emails.map((e: any) => e.id));
      }
      if (nodeResult.data?.emailIds) {
        emailIds.push(...nodeResult.data.emailIds);
      }
    }
  }
  
  // Filter to only include emails that exist in test inbox
  return emailIds.filter(id => inbox.emails.some(e => e.id === id));
}

/**
 * Determine response type based on orchestrator result
 */
function determineResponseType(result: any, query: string): 'email_list' | 'summary' | 'calendar_info' | 'boolean_answer' {
  const message = result.message.toLowerCase();
  
  if (message.includes('calendar') || message.includes('meeting')) {
    return 'calendar_info';
  }
  
  if (query.toLowerCase().includes('yes') || query.toLowerCase().includes('no')) {
    return 'boolean_answer';
  }
  
  if (message.includes('summary') || message.includes('overview')) {
    return 'summary';
  }
  
  return 'email_list';
}
```

## 🔧 **Step 3: Add Required Imports**

Add these imports at the top of `example.ts`:

```typescript
import { createAppContainer } from '../../src/di/container';
import { OrchestratorService } from '../../src/layers/orchestrator.service';
```

## 🚀 **Step 4: Run Tests**

Now you can run the existing e2e tests with your real orchestrator:

```bash
# Generate test inbox (if not already done)
npm run e2e:generate-inbox founder

# Run tests with real orchestrator
npx ts-node tests/e2e/evaluation-v2/example.ts single
```

## ✅ **What This Achieves**

### **Before (Mock)**
- ❌ Simple mock chatbot
- ❌ Basic filtering logic
- ❌ No real orchestrator testing

### **After (Real Orchestrator)**
- ✅ **Real 3-layer orchestrator** processing
- ✅ **Real query decomposition** 
- ✅ **Real execution strategies**
- ✅ **Real synthesis layer**
- ✅ **Comprehensive evaluation** of your actual system

## 🎯 **Key Benefits**

1. **Tests Your Real System**: Uses your actual orchestrator instead of mocks
2. **Minimal Changes**: Only replaces one function
3. **Existing Infrastructure**: Uses all the existing e2e testing infrastructure
4. **No Duplication**: Doesn't duplicate existing functionality
5. **Easy to Maintain**: Simple integration that's easy to understand

## 🔍 **How It Works**

```
┌─────────────────────────────────────────────────────────────────┐
│                    INTEGRATED E2E TESTING                       │
└─────────────────────────────────────────────────────────────────┘

Test Inbox → yourChatbotFunction → Real Orchestrator → Response
     ↓              ↓                      ↓              ↓
JSON Data → Query Processing → 3-Layer Pipeline → ChatbotResponse
     ↓              ↓                      ↓              ↓
Ground Truth → Intent Parsing → Execution → Multi-Layer Evaluation
```

## 📊 **Expected Output**

```
🚀 Starting Automated Test Run
📧 Step 1: Loading inbox...
   ✅ Loaded 50 emails (founder persona)
🔍 Step 2: Preparing queries...
   ✅ Generated 25 queries
🤖 Step 3: Running chatbot...
   [1/25] "What needs my attention right now?"
      [Real Orchestrator] Processing: "What needs my attention right now?"
      ✅ Returned 5 emails (1,250ms)
   [2/25] "Show me urgent emails"
      [Real Orchestrator] Processing: "Show me urgent emails"
      ✅ Returned 4 emails (980ms)
   ...
⚖️  Step 4: Evaluating responses...
   [1/25] Evaluating "What needs my attention right now?"
      ✅ Score: 85/100
   [2/25] Evaluating "Show me urgent emails"
      ✅ Score: 92/100
   ...
```

## 🎯 **That's It!**

This simple integration gives you:
- ✅ **Real orchestrator testing** with existing e2e infrastructure
- ✅ **No duplicate code** or unnecessary complexity
- ✅ **Easy to understand** and maintain
- ✅ **Production-ready** testing of your actual system

The existing e2e testing system was already excellent - it just needed to be connected to your real orchestrator instead of the mock function!
