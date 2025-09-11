P1: Replace Agent Config String Patterns

  **Goal:** Replace AGENT_HELPERS.detectOperation() string matching with OpenAI classification

  **File:** backend/src/config/agent-config.ts (lines 246-264)

  **Current Problem:**
  ```typescript
  const operationPatterns = {
    read: ['what do i have', 'show me', 'today'],
    send: ['send', 'email', 'message'],
    create: ['create', 'schedule', 'new']
  };
  if (lowerQuery.includes(pattern)) return operation;

  Solution: Replace with OpenAI function calling:
  async detectOperation(query: string, agentName: string): Promise<string> {
    const openaiService = getService<OpenAIService>('openaiService');
    const response = await openaiService.generateText(
      `Classify this user request for ${agentName}: "${query}"
      
      Operations: read, write, search, create, update, delete
      Return only the operation name.`,
      'You classify user intents. Return only: read, write, search, create, update, or delete',
      { temperature: 0.1, maxTokens: 10 }
    );
    return response.trim().toLowerCase();
  }

  Integration: Keep same function signature, just change implementation
  Testing: Verify classification works for existing test cases

  ---

  ## **P2: Replace Contact Lookup String Matching**

  Goal: Replace needsContactLookup() and extractContactName() string matching with LLM entity extraction

  File: backend/src/agents/master.agent.ts (around line 334)

  Current Problem:
  private needsContactLookup(userInput: string): boolean {
    const input = userInput.toLowerCase();
    return input.includes('email') || input.includes('send') ||
           input.includes('meeting') || input.includes('schedule');
  }

  Solution: Replace with AI entity extraction:
  private async needsContactLookup(userInput: string): Promise<{needed: boolean, names: string[]}> {
    const openaiService = getService<OpenAIService>('openaiService');

    const response = await openaiService.generateText(
      `Extract person names that need contact lookup: "${userInput}"
      
      Return JSON: {"needed": boolean, "names": ["name1", "name2"]}
      
      Examples:
      - "Send email to John" → {"needed": true, "names": ["John"]}
      - "What's on my calendar?" → {"needed": false, "names": []}`,
      'Extract contact names from user requests. Always return valid JSON.',
      { temperature: 0, maxTokens: 100 }
    );

    try {
      return JSON.parse(response);
    } catch {
      return { needed: false, names: [] };
    }
  }

  Integration: Update calling code to handle async and new return format
  Testing: Verify contact detection works for names without emails

  ---

  ## **P3: Replace Confirmation String Matching**

  Goal: Replace isConfirmationResponse() word arrays with LLM intent classification

  File: backend/src/services/slack-interface.service.ts

  Current Problem:
  private isConfirmationResponse(text: string): boolean {
    const confirmWords = ['yes', 'y', 'confirm', 'ok', 'proceed'];
    const rejectWords = ['no', 'n', 'cancel', 'abort'];
    return confirmWords.includes(normalized) || rejectWords.includes(normalized);
  }

  Solution: Replace with AI intent detection:
  private async classifyConfirmationResponse(text: string): Promise<'confirm' | 'reject' | 'unknown'> {
    const openaiService = getService<OpenAIService>('openaiService');

    const response = await openaiService.generateText(
      `Classify this response to a confirmation request: "${text}"
      
      Return exactly one word: confirm, reject, or unknown
      
      Examples:
      - "yes" → confirm
      - "go for it" → confirm  
      - "not now" → reject
      - "weather is nice" → unknown`,
      'Classify confirmation responses. Return only: confirm, reject, or unknown',
      { temperature: 0, maxTokens: 5 }
    );

    const result = response.trim().toLowerCase();
    if (['confirm', 'reject', 'unknown'].includes(result)) {
      return result as 'confirm' | 'reject' | 'unknown';
    }
    return 'unknown';
  }

  Integration: Update confirmation flow to use new async classification
  Testing: Verify various confirmation styles work correctly

  ---

  ## **Bonus: Service Priority Fix**

  File: backend/src/services/service-initialization.ts (line 158)

  Change:
  // FROM:
  priority: 45,

  // TO:  
  priority: 15, // High priority - required for zero string matching

  Why: Makes OpenAI service initialize early and be treated as critical

  ---

  ## **Implementation Order** 📋

  1. **Start with P3** (confirmation) - easiest, immediate user impact
  2. **Then P1** (agent config) - core operation detection
  3. **Finally P2** (contact lookup) - most complex due to async changes
  4. **Bonus fix** - 1 line change

  ## **Success Criteria** ✅

  - [ ] No `string.includes()` calls for intent detection
  - [ ] No regex patterns for operation classification
  - [ ] No hard-coded word arrays
  - [ ] All existing functionality still works
  - [ ] OpenAI calls handle edge cases gracefully