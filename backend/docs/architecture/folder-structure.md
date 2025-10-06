# Folder Structure

## Overview

This document provides a comprehensive overview of the project's folder structure and organizational principles.

## Project Root

```
assistantapp/
├── backend/             # Node.js/TypeScript API server
├── frontend/            # React Native mobile application
├── logs/                # Application logs (gitignored)
├── node_modules/        # Root dependencies
├── .env                 # Environment variables (gitignored)
├── .gitignore          # Git ignore rules
├── package.json         # Root package configuration
└── README.md           # Project documentation
```

## Backend Structure

### Complete Directory Tree

```
backend/
├── config/              # Configuration files
│   └── credentials/     # OAuth credentials (gitignored)
├── data/                # Runtime data
│   └── oauth-tokens/    # Stored OAuth tokens
├── dist/                # Compiled JavaScript (gitignored)
├── docs/                # Documentation
│   ├── adr/             # Architecture Decision Records
│   └── architecture/    # Architecture documentation
├── eslint-rules/        # Custom ESLint rules
├── examples/            # Example code/usage
├── logs/                # Application logs
├── migrations/          # Database migrations
├── node_modules/        # Dependencies (gitignored)
├── public/              # Public assets
│   └── utils/
├── scripts/             # Build/deployment scripts
│   └── utils/
├── src/                 # Source code (see below)
├── tests/               # Test files (see below)
├── .eslintrc.dev.js     # ESLint config (dev)
├── eslint.config.js     # ESLint config (main)
├── eslint.config.strict.js  # ESLint strict mode
├── jest.config.js       # Jest configuration
├── jest.e2e.config.js   # E2E test configuration
├── package.json         # Backend dependencies
├── tsconfig.json        # TypeScript config (development)
├── tsconfig.prod.json   # TypeScript config (production)
└── tsconfig.strict.json # TypeScript strict mode
```

### Source Code Structure (`src/`)

```
src/
├── config/              # Application configuration
│   ├── agent-config.ts         # AI agent configuration
│   ├── calendar-service-constants.ts
│   ├── config-loader.ts        # Config loading logic
│   ├── config-schema.ts        # Config validation schemas
│   ├── constants.ts            # App-wide constants
│   ├── email-service-constants.ts
│   ├── service-config.ts       # Service configuration
│   ├── unified-config.ts       # Unified config object
│   └── index.ts
│
├── constants/           # Application constants
│   └── oauth-scopes.ts         # OAuth scope definitions
│
├── di/                  # Dependency Injection
│   ├── registrations/          # Service registrations
│   │   ├── ai-services.ts
│   │   ├── auth-services.ts
│   │   ├── core-services.ts
│   │   ├── domain-services.ts
│   │   ├── framework-services.ts
│   │   ├── layer-services.ts
│   │   ├── middleware-services.ts
│   │   └── index.ts
│   ├── container.ts            # DI container setup
│   └── index.ts
│
├── docs/                # API Documentation
│   └── swagger.ts              # Swagger/OpenAPI setup
│
├── errors/              # Error Handling
│   ├── error-codes.ts          # Error code definitions
│   ├── error-factory.ts        # Error creation helpers
│   ├── external-api-error-types.ts
│   ├── retry-manager.ts        # Retry logic
│   ├── specialized-errors.ts   # Custom error classes
│   ├── transformers.ts         # Error transformers
│   ├── type-guards.ts          # Error type guards
│   └── index.ts
│
├── framework/           # Framework Abstractions
│   ├── base-route-handler.ts  # Base route class
│   ├── tool-execution.ts       # Tool execution logic
│   ├── tool-registry.ts        # Tool registration
│   └── index.ts
│
├── layers/              # 3-Layer Architecture
│   ├── layer1-decomposition/
│   │   ├── decomposition-prompt-builder.ts
│   │   ├── execution-graph-validator.ts
│   │   ├── execution-graph.types.ts
│   │   └── query-decomposer.service.ts
│   ├── layer2-execution/
│   │   ├── strategies/         # Execution strategies
│   │   │   ├── base-strategy.ts
│   │   │   ├── batch-thread-read-strategy.ts
│   │   │   ├── cross-reference-strategy.ts
│   │   │   ├── keyword-search-strategy.ts
│   │   │   ├── metadata-filter-strategy.ts
│   │   │   └── semantic-analysis-strategy.ts
│   │   ├── execution-coordinator.service.ts
│   │   ├── execution.types.ts
│   │   ├── strategy-metadata.ts
│   │   └── strategy-registry.ts
│   ├── layer3-synthesis/
│   │   ├── synthesis.service.ts
│   │   └── synthesis.types.ts
│   ├── orchestrator.service.ts
│   └── orchestrator.types.ts
│
├── middleware/          # Express Middleware
│   ├── api-logging.middleware.ts
│   ├── error-correlation.middleware.ts
│   ├── error-handler.middleware.ts
│   ├── rate-limiting.middleware.ts
│   ├── request-logger.middleware.ts
│   ├── security.middleware.ts
│   ├── sentry.middleware.ts
│   ├── supabase-auth.middleware.ts
│   └── validation.middleware.ts
│
├── routes/              # API Routes
│   ├── auth/                   # Authentication routes
│   │   ├── debug/              # Debug endpoints
│   │   │   ├── config.routes.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── chat.routes.ts          # Chat API routes
│   └── protected.routes.ts     # Protected endpoints
│
├── schemas/             # Validation Schemas
│   ├── api.schemas.ts          # API validation schemas
│   ├── auth.schemas.ts         # Auth validation schemas
│   ├── calendar.schemas.ts     # Calendar schemas
│   ├── common.schemas.ts       # Shared schemas
│   ├── contact.schemas.ts      # Contact schemas
│   ├── email.schemas.ts        # Email schemas
│   └── index.ts
│
├── services/            # Business Logic Services
│   ├── api/                    # External API Clients
│   │   ├── clients/
│   │   │   ├── google-api-client.ts
│   │   │   ├── openai-api-client.ts
│   │   │   └── index.ts
│   │   ├── api-client-registry.ts
│   │   ├── base-api-client.ts
│   │   ├── data-loader.ts
│   │   └── index.ts
│   ├── domain/                 # Domain Services
│   │   ├── interfaces/         # Service interfaces
│   │   │   ├── ai-domain.interface.ts
│   │   │   ├── base-domain.interface.ts
│   │   │   ├── calendar-domain.interface.ts
│   │   │   └── index.ts
│   │   ├── strategies/         # Operation strategies
│   │   │   ├── base-operation-strategy.ts
│   │   │   ├── operation-executor.ts
│   │   │   └── index.ts
│   │   ├── ai-domain.service.ts
│   │   ├── base-domain.service.ts
│   │   ├── calendar-domain.service.ts
│   │   ├── contacts-domain.service.ts
│   │   ├── email-domain.service.ts
│   │   └── index.ts
│   ├── ai-circuit-breaker.service.ts
│   ├── base-service.ts         # Base service class
│   ├── cache.service.ts        # Caching service
│   ├── encryption.service.ts   # Encryption utilities
│   ├── error-handling.service.ts
│   ├── feature-flags.service.ts
│   ├── sentry.service.ts       # Error tracking
│   ├── supabase-token-provider.ts
│   ├── user-context.service.ts
│   └── user-preferences.service.ts
│
├── templates/           # Templates (HTML, Email)
│   └── html-templates.ts
│
├── types/               # Shared TypeScript Types
│   ├── api/                    # API-related types
│   │   ├── api-client.types.ts
│   │   ├── api.types.ts
│   │   └── retry-strategy.types.ts
│   ├── calendar/               # Calendar types
│   │   └── index.ts
│   ├── auth.types.ts           # Authentication types
│   ├── branded-types.ts        # Branded type utilities
│   └── service.types.ts        # Service interfaces
│
├── utils/               # Utility Functions
│   ├── app-error.ts            # Error utilities
│   ├── audit-logger.ts         # Audit logging
│   ├── log-context.ts          # Logging context
│   ├── logger.ts               # Winston logger
│   ├── prompt-utils.ts         # Prompt helpers
│   ├── response-validation.util.ts
│   ├── service-validation.util.ts
│   ├── type-guards.util.ts     # Type guards
│   ├── validation.utils.ts     # Validation helpers
│   └── validation-helpers.util.ts
│
├── validation/          # Validation Logic
│   ├── api-client.validation.ts
│   └── shared-validation-schemas.ts
│
└── index.ts             # Application entry point
```

### Test Structure (`tests/`)

```
tests/
├── e2e/                 # End-to-End Tests
│   ├── data/                   # Test data
│   ├── evaluation/             # Evaluation framework
│   ├── evaluation-v2/          # New evaluation system
│   ├── evaluators/             # Test evaluators
│   ├── generators/             # Test data generators
│   ├── mocks/                  # Mock data/services
│   ├── models/                 # Test models
│   ├── reporters/              # Test reporters
│   ├── reports/                # Generated reports
│   ├── scenarios/              # Test scenarios
│   ├── scripts/                # Test scripts
│   ├── suites/                 # Test suites
│   └── workflows/              # Workflow tests
│
├── integration/         # Integration Tests
│   └── (mirrors src structure)
│
├── layers/              # Layer-specific Tests
│   ├── layer1/                 # Decomposition tests
│   ├── layer2/                 # Execution tests
│   └── layer3/                 # Synthesis tests
│
├── unit/                # Unit Tests
│   ├── middleware/             # Middleware tests
│   └── services/               # Service tests
│
└── utils/               # Test Utilities
```

## Frontend Structure

### React Native Application

```
frontend/ChatbotApp/
├── src/
│   ├── components/             # React Components
│   │   ├── messages/           # Message components
│   │   │   ├── AssistantMessage.tsx
│   │   │   ├── SystemMessage.tsx
│   │   │   ├── UserMessage.tsx
│   │   │   ├── index.ts
│   │   │   └── README.md
│   │   ├── onboarding/         # Onboarding flow
│   │   │   ├── EmailConnectionScreen.tsx
│   │   │   ├── OnboardingCompleteScreen.tsx
│   │   │   ├── OnboardingContext.tsx
│   │   │   ├── OnboardingFlow.tsx
│   │   │   ├── PermissionsScreen.tsx
│   │   │   ├── ProgressIndicator.tsx
│   │   │   ├── Tooltip.tsx
│   │   │   ├── TutorialManager.tsx
│   │   │   ├── WelcomeScreen.tsx
│   │   │   └── index.ts
│   │   ├── examples/           # Example components
│   │   │   └── ChatExample.tsx
│   │   ├── ChatInput.tsx
│   │   ├── ChatInterface.tsx
│   │   ├── EmptyState.tsx
│   │   ├── LoadingIndicator.tsx
│   │   ├── Message.tsx
│   │   ├── MessageBubble.tsx
│   │   └── index.ts
│   │
│   ├── config/                 # Configuration
│   │   └── supabase.ts         # Supabase config
│   │
│   ├── design-system/          # Design System
│   │   ├── components/         # DS components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── ChatInterface.tsx
│   │   │   ├── ChatMessage.tsx
│   │   │   ├── Text.tsx
│   │   │   └── index.ts
│   │   ├── index.ts            # Design tokens
│   │   ├── README.md
│   │   └── tailwind.config.js
│   │
│   ├── services/               # Business Logic
│   │   ├── api.service.ts      # API client
│   │   ├── offline.service.ts  # Offline support
│   │   └── storage.service.ts  # Local storage
│   │
│   ├── types/                  # TypeScript types
│   │   └── index.ts
│   │
│   └── utils/                  # Utilities
│       └── messageUtils.ts
│
├── android/             # Android native code
├── ios/                 # iOS native code
├── App.tsx              # Root component
├── babel.config.js      # Babel configuration
├── metro.config.js      # Metro bundler config
├── package.json         # Dependencies
└── tsconfig.json        # TypeScript config
```

## Organization Principles

### 1. Feature-Based Organization
Group related files by feature/domain rather than by file type.

**Good:**
```
services/domain/
  email-domain.service.ts
  email-domain.types.ts
  email-domain.interface.ts
```

**Avoid:**
```
services/
  email-domain.service.ts
types/
  email-domain.types.ts
interfaces/
  email-domain.interface.ts
```

### 2. Consistent Test Mirroring
Test structure should mirror source structure for unit and integration tests.

```
src/services/domain/email-domain.service.ts
tests/unit/services/domain/email-domain.service.test.ts
```

### 3. Barrel Exports
Use `index.ts` files for clean public APIs:

```typescript
// services/domain/index.ts
export { EmailDomainService } from './email-domain.service';
export type { EmailSearchOptions } from './email-domain.types';
```

### 4. Separation of Concerns
- **Domain logic** in `services/domain/`
- **API clients** in `services/api/`
- **Infrastructure** at `services/` root
- **Framework** in `framework/`
- **Types** in `types/` (shared) or co-located

## See Also
- [Naming Conventions](./naming-conventions.md)
- [Types Organization](./types-organization.md)
- [Import Patterns](./import-patterns.md)
