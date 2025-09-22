## Unified Intent → Step Planning → Execution Loop

### Purpose
Define a single, consistent flow where every request is:
1) Interpreted via intent analysis; 2) Turned into a step-by-step plan; 3) Executed stepwise with re-evaluation after each step; 4) Completed with a clear user response (and follow-ups where needed).

### High-level flow
1. Context gathering + intent analysis (LLM)
   - Gather recent conversation signals (e.g., last N Slack messages in the DM/thread, any pending draft prompts, user confirmations like "yes/no").
   - Analyze user input + gathered context to determine: confirmation/update of a draft, read request, or new/write request; and produce a structured intent with confidence.
   - Do not execute or create drafts at this stage; intent only informs planning.

2. Plan creation (LLM)
   - Convert the intent into a minimal next-step plan (one step at a time), including the target agent, operation, and parameters.
   - Example for email write: (1) contactAgent.resolve → (2) emailAgent.compose (draft) → (3) emailAgent.send (only when explicitly approved).

3. Execution loop (applies to ALL requests, including read-only)
   - Execute the planned step via ToolExecutorService → AgentFactory → Agent.
   - Capture the result and re-evaluate with the planner to decide: continue, ask for user input, or finish.

4. Re-evaluation (LLM)
   - Based on step result and gathered context, determine next step, need for user input, or completion.
   - The loop runs until the task is done, blocked on user input, or reaches safety limits.

5. Completion
   - Synthesize a natural response summarizing what happened and any follow-ups.

### Component responsibilities
- MasterAgent
  - Single entry point and orchestration owner (Slack/API both call the same entry).
  - Always gather context and run intent analysis first, then proceed into the step-by-step loop for all requests (read and write).
  - Deprecate special-case routers (e.g., `routeBasedOnIntent`) by folding decisions into the first plan steps.
- NextStepPlanningService
  - LLM-driven planning and re-evaluation (planNextStep, analyzeStepResult).
  - Encodes planning rules and output contracts.
- ToolExecutorService
  - Validates ToolCall, dispatches to the mapped agent, and returns a normalized ToolResult.
- AgentFactory / Agents
  - Provide capabilities and OpenAI schemas, implement real work for each domain.
- DraftManager
  - Drafts are created by an explicit “compose draft” step (e.g., emailAgent.compose), not by routing.
  - Execute/cancel drafts via a planned confirmation step once the user approves.

### Contracts (summaries)
- IntentAnalysis (LLM output)
  - intentType: confirmation_positive | confirmation_negative | draft_modification | new_request | new_write_operation | read_operation
  - confidence: number
  - newOperation / readOperations / targetDraftId / modifications (as applicable)

- NextStepPlan
  - stepNumber, description, agent, operation, parameters, reasoning, isComplete

- StepResult
  - stepNumber, agent, operation, parameters, result, success, error, executedAt

- StepAnalysis (LLM output)
  - shouldContinue, isComplete, needsUserInput, analysis, updatedContext?

### Planning rules (examples)
- Email write
  - If recipient ambiguous: plan contactAgent.resolve before emailAgent.compose.
  - Compose step must mark “awaiting confirmation” instead of sending.
- Calendar write
  - Validate date/time and duration; plan contact resolution for attendees before create.
- Read-only
  - Use the same loop: the first planned step can be a single read operation; still re-evaluate and synthesize.

### Sequence (pseudocode)
```
handleRequest(input, session, user, context):
  gathered = gatherContext(context)           // e.g., recent Slack messages, pending drafts
  intent = analyzeIntent(input, gathered)

  // all requests go through the same loop (read + write)
  loopContext = initWorkflow(input, user, context)
  while loopContext.currentStep <= MAX_STEPS:
    plan = planNextStep(loopContext)
    if plan == null: break

    result = executeTool(plan.agent, plan.operation, plan.parameters)
    analysis = analyzeStepResult(result, loopContext)
    update(loopContext, result, analysis)

    if analysis.isComplete: break
    if analysis.needsUserInput: break

  return synthesize(loopContext.completedSteps)
```

### User confirmations in the loop
- Confirmation becomes a planned step (e.g., “await user approval”).
- If the user confirms, run the draft execution step (e.g., DraftManager.executeDraft).
- If the user cancels, plan to clean up the draft and return a cancellation message.

### Error and timeout handling
- Add bounded timeouts to intent analysis, planNextStep, and analyzeStepResult. On timeout, return a user-friendly message and/or ask for clarification.
- Retry policy for transient tool failures (exponential backoff, small cap).
- Enforce max steps per workflow.

### Observability
- Log at phase boundaries: intent→plan, plan→execute, execute→analyze, completion.
- Emit correlationId, sessionId, stepNumber, agent, operation, success/failure, and durations.

### Integration with Slack/API
- Entry handlers should ACK quickly (Slack /events) and post a “Working on it…” message.
- Gather short conversation context (last N messages in the DM/thread) for intent.
- Post intermediate messages for needsUserInput, and final message at completion or failure.

### Migration guide (to align current code)
1) Single entry
   - Use one entry (e.g., `processUserInput`) for Slack/API: gather context → intent analysis → step loop. Deprecate `processUserInputUnified` and `routeBasedOnIntent` in favor of planning-first execution.

2) Planner-first handoff
   - For all intents (read/write/confirmation/modification), plan the next step(s) instead of creating drafts or executing reads inside routing. Confirmation-positive can plan “execute draft”; negative can plan “cleanup/cancel draft.”

3) Planning prompts
   - Update `NextStepPlanningService` to include context-gathering signals and to reinforce “resolve → compose draft → (optional) send” patterns and other domain-specific sequences.

4) Messaging
   - Ensure Slack service posts interim and final messages so users see progress.

### Acceptance criteria
- Every new/write request runs through: intent → plan → execute → analyze (loop), with drafts created only by planned steps.
- Read-only requests may short-circuit safely.
- Confirmations are steps in the plan (no out-of-band draft creation during routing).
- Logs show clear progression across phases and steps.


