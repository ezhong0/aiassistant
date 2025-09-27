## Synthesized Implementation Plan: Context → Plan → Execute (Natural-Language Inter-Agent)

### Purpose
Create a practical, high-impact foundation that excels at: collecting the right context, turning intent into an executable plan, and reliably executing with safety. Emphasize a natural-language interface between agents. Keep complexity only where it materially improves outcomes.

### Sources Synthesized
- Reference: `docs/planning/redesign/ai-system-design.md`
- Use cases: `docs/planning/redesign/usecase.md`
- Claude’s evaluation lens (use-case coverage, viability, operations, scalability)

### Where We Align (with Claude’s lens)
- Natural-language agent coordination is central and viable if bounded by timeouts, idempotency, and state authority.
- Context must be useful day one: light bootstrap now, richer learning later.
- Safety needs explicit previews/approvals, audit trails, and rollbacks.
- TodoWrite-style workflow state is appropriate if we start with linear/branching dependencies and keep persistence simple.

### Gaps We Close Here
- Narrow initial API surface (don’t chase full Gmail/Calendar coverage). Implement only endpoints needed by top-impact workflows.
- Specify a concrete NL Inter-Agent Protocol (message schema, types, timeouts, correlation IDs, safety tags, idempotency).
- Define a minimal but powerful context schema and ingestion rules with privacy boundaries.
- Establish authoritative state ownership and reconciliation policy to avoid agent drift.
- Set initial metrics/SLAs for latency, reliability, and learning signals.

---

## Architecture (MVP Scope)

### Components
- Master Orchestrator
  - Intent decomposition, context synthesis, task graph planning, approvals, authority over workflow state
  - Converses with domain agents using Natural-Language Inter-Agent Protocol (NLIP)
- Email Agent (Gmail subset)
  - Draft/send emails, fetch threads/labels minimally, create simple sequences (1 follow-up)
- Calendar Agent (Google Calendar subset)
  - Free/busy for primary calendar, event create/update, simple room selection (static list or tag)
- Shared Context Service
  - Entity graph (People, Organizations, Threads, Events, Preferences), relationship strength, minimal preferences
- Workflow Engine (TodoWrite)
  - Tracks tasks: pending → in_progress → completed → failed; dependencies; persistence; interruption handling

### Boundaries and Authority
- Master Orchestrator is the source of truth for workflow state and approval gates.
- Shared Context Service is the source of truth for entity/relationship data.
- Agents are stateless operators that produce results and context updates; they never authoritatively change workflow state.

---

## Natural-Language Inter-Agent Protocol (NLIP v1)

### Message Envelope
```
message_id: <uuid>
correlation_id: <uuid of workflow or task>
timestamp: <iso8601>
sender: <agent_name>
recipient: <agent_name|master>
priority: <low|normal|high>
safety: <low|medium|high>
attempt: <int>  # for retries
```

### Message Types
- Command: Delegation from Master → Agent (task with context)
- Status: Progress update from Agent → Master
- Result: Completion with outputs and context deltas
- Query: Capability/context questions between agents via Master
- Error: Failure with retryability classification and diagnostics

### Payload Shapes
- Command
  - task_name, parameters, context_refs, constraints, deadline_hint
- Status
  - task_name, progress_percent, note, next_eta
- Result
  - task_name, outputs (structured), context_updates (entity upserts), artifacts (e.g., draft IDs)
- Error
  - task_name, error_code, retryable: bool, recommendation (alternative path)

### Protocol Rules
- Timeouts: default 10s per hop; Master may extend for long ops with keep-alive Status.
- Idempotency: provide idempotency_key in Command; agents must be safe to retry.
- Batching: Master may batch independent Commands; agents may stream Status.
- Safety tags: medium/high require preview or explicit approval before Result is acted upon (send/commit).
- Deterministic handoffs: Agents never directly modify other agents’ state; all coordination flows through Master.

---

## Context System v1 (Day‑One Useful, Privacy‑Respecting)

### Bootstrap Sources
- Email: last N threads (e.g., 200) metadata only; do not store raw bodies, store lightweight summaries when needed.
- Calendar: next/prev 60 days events metadata; attendees; rooms; availability windows.
- Manual: user-provided preferences (tone formality, working hours, VIP contacts, room preferences).

### Schema (Minimal, Extensible)
- People: email, name, relationship_strength (computed), vip_flag, preferences (tone, timing)
- Organizations: domain(s), relationship_notes
- Threads: participants, subject, last_activity_at, tags (e.g., "board", "customer")
- Events: start/end, attendees, location/room_tag, importance_score
- Preferences: working_hours, timezones, approval_thresholds

### Learning Signals (Lightweight)
- Email outcomes: sent, opened (if available), replied, reply_latency
- Calendar outcomes: accepted/declined, reschedule_count
- Preference confirmations: explicit user edits take precedence over inferred

### Privacy
- Store only metadata and summaries; encrypt at rest; allow redaction and re-index.
- No signature scraping or full-body storage in MVP; add later with explicit consent.

---

## Planning Engine v1

### Intent to Task Graph
- Decompose into linear or lightly branched tasks with explicit dependencies.
- Examples:
  - Meeting coordination: Analyze availability → Propose slot → Book event → Draft invites
  - Survey campaign: Segment list → Draft email → Send → Follow-up non-responders

### Constraints and Risk
- Constraints: working hours, attendee VIPs, prep-time policy, room tags.
- Risk tiers: low (auto), medium (preview), high (explicit approval). Master enforces gates.

### Estimation and Selection
- Simple heuristics: attendee count, cross-timezone penalty, calendar density.
- Pick simplest feasible plan first; escalate complexity only if needed.

---

## Execution Engine v1 (TodoWrite)

### State Model
- Task: id, name, state, depends_on[], assignee, safety_level, idempotency_key
- Transitions: pending → in_progress → completed | failed | cancelled
- Persistence: durable store with correlation_id indices; resilient to restarts

### Reliability
- Retries with exponential backoff for retryable errors; cap attempts; surface alternatives.
- Compensation: for calendar/email mutations, provide inverse ops when possible (delete event, send correction email draft for approval).
- Interruption handling: pause/resume/cancel at workflow or task level.

### Approval Gates
- Medium/high-risk tasks require preview artifacts (draft email text, event delta summary) for user approval.

---

## Interfaces (MVP)
- CLI or HTTP API for triggering intents and approvals.
- Optional Slack UI wrapper for status and approvals later.

---

## Acceptance Criteria (Maps to `usecase.md`)

### Meeting Coordination (board meeting)
- Find a feasible 2h slot next month for defined attendees using free/busy.
- Book event and room_tag from a configurable list; attach dial-in.
- Draft invite email including agenda-request and RSVP tracking token; require approval before send.
- Track workflow states and allow cancel/reschedule with clear alternatives if conflict.

### Email Campaign (survey with one follow-up)
- Send initial survey email to a small list (≤ 200) and schedule one follow-up to non-responders in 7 days.
- Record outcomes (basic metrics) and update relationship_strength heuristics.

### Calendar Optimization (lightweight)
- Detect back-to-back block pattern for next day, propose inserting 15-minute buffers for internal meetings; draft reschedule emails for approval.

---

## High-Impact Enhancements (Phase 1.5)
- RSVP tracking via unique links for invitees; update event notes with counts.
- Delegated calendar consideration for 1 additional calendar (e.g., EA access).
- Relationship-aware tone selection (formal vs casual) driven by preferences + minimal learned signal.
- Prepared replies/templates for common meeting logistics.

Out-of-scope for MVP: full Gmail/Calendar coverage, deep signature parsing, multi-agent parallel negotiation loops, complex influence mapping.

---

## Metrics, SLAs, and Telemetry
- Latency: 95th percentile Command→Result under 5s for metadata ops; under 20s for networked mutations.
- Reliability: ≥ 99% successful task completion excluding external API outages.
- Learning: track open/reply rates, acceptance rates, reschedule counts.
- Safety: 100% coverage of audit logs for medium/high-risk actions; zero unintended sends/changes in test suite.

---

## Data and Security
- Encrypt context store; least-privilege OAuth scopes; token rotation.
- Redaction pipeline for summaries; deletion on request.
- Audit log includes who/what/when for every external mutation and approval.

---

## Delivery Plan

### Milestone 1: Skeleton and Protocol
- Implement NLIP v1 envelope, types, timeouts, and idempotency.
- Master Orchestrator planning for two intents; Workflow Engine with persistence.
- Basic Context Service with manual preferences and email/calendar metadata ingestion.

### Milestone 2: Calendar Flow
- Free/busy, event create/update, room_tag support; approval gate and rollback.
- Draft invite emails from Calendar results (without sending yet), preview UI/API.

### Milestone 3: Email Flow
- Draft/send emails with one follow-up sequence; non-responder detection; minimal metrics.

### Milestone 4: Optimization and Polishing
- Buffer insertion suggestions; reschedule draft automation; RSVP link support.
- Harden retries, compensation, and state reconciliation; add selected dashboards.

---

## Traceability
- Aligns with `ai-system-design.md` principles: agent specialization, conversational coordination, safety, and learning.
- Directly covers high-value `usecase.md` items: board meeting coordination, survey follow-up, light calendar optimization.


