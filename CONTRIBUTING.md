# Contributing to Assistant App

Thank you for your interest in contributing! This document provides guidelines and standards for contributing to this project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
  - [File Naming](#file-naming)
  - [Directory Structure](#directory-structure)
  - [TypeScript Standards](#typescript-standards)
  - [Import Patterns](#import-patterns)
- [Testing](#testing)
- [Git Workflow](#git-workflow)
- [Documentation](#documentation)

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- Git

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd assistantapp

# Install dependencies
npm install

# Setup backend
cd backend
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Run backend
npm run dev

# In another terminal, setup frontend
cd frontend/ChatbotApp
npm install

# Run frontend (iOS)
npm run ios

# Run frontend (Android)
npm run android
```

## Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the code standards below

3. **Test your changes**
   ```bash
   # Backend
   cd backend
   npm run typecheck
   npm run lint
   npm run test
   ```

4. **Commit your changes** (see [Git Workflow](#git-workflow))

5. **Push and create a pull request**

## Code Standards

### File Naming

#### Backend (TypeScript/Node.js)

| File Type | Pattern | Example |
|-----------|---------|---------|
| Services | `[name].service.ts` | `email-domain.service.ts` |
| Middleware | `[name].middleware.ts` | `error-handler.middleware.ts` |
| Routes | `[name].routes.ts` | `protected.routes.ts` |
| Types | `[name].types.ts` | `api-client.types.ts` |
| Schemas | `[name].schemas.ts` | `contact.schemas.ts` |
| Utils | `[name].util.ts` | `validation.util.ts` |
| Tests | `[name].test.ts` | `email-domain.service.test.ts` |

#### Frontend (React Native/TypeScript)

| File Type | Pattern | Example |
|-----------|---------|---------|
| Components | `PascalCase.tsx` | `WelcomeScreen.tsx` |
| Hooks | `use[Name].ts` | `useAuth.ts` |
| Services | `[name].service.ts` | `api.service.ts` |
| Utils | `[name]Utils.ts` | `messageUtils.ts` |

**Key Rules:**
- Use **kebab-case** for backend files
- Use **PascalCase** for React components
- Use descriptive, intention-revealing names
- Include appropriate file type suffix (`.service.ts`, `.middleware.ts`, etc.)

### Directory Structure

#### Backend

```
backend/src/
├── config/              # Configuration files
├── di/                  # Dependency injection
├── errors/              # Error handling
├── framework/           # Framework abstractions
├── layers/              # 3-layer architecture
├── middleware/          # Express middleware
├── routes/              # API routes
├── schemas/             # Validation schemas
├── services/            # Business logic
│   ├── api/             # External API clients
│   └── domain/          # Domain services
├── types/               # Shared TypeScript types
├── utils/               # Utility functions
└── validation/          # Validation logic
```

#### Frontend

```
frontend/ChatbotApp/src/
├── components/          # React components
│   ├── messages/        # Feature-specific components
│   └── onboarding/
├── design-system/       # Design system
│   └── components/      # DS components
├── services/            # Business logic
├── types/               # TypeScript types
└── utils/               # Utilities
```

**Organizational Principles:**
1. **Feature-based organization** - Group related files together
2. **Clear separation of concerns** - Domain, API, infrastructure
3. **Consistent test mirroring** - Tests mirror source structure
4. **Barrel exports** - Use `index.ts` for clean APIs

### TypeScript Standards

#### Naming Conventions

```typescript
// Classes: PascalCase
class EmailDomainService { }

// Interfaces: PascalCase
interface EmailSearchOptions { }

// Types: PascalCase
type UserRole = 'admin' | 'user';

// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;

// Functions & Variables: camelCase
function validateEmail(email: string): boolean { }
const userEmail = 'user@example.com';

// Boolean variables: is/has/should prefix
const isValid = true;
const hasPermission = false;

// Async functions: use async/await
async function fetchData() { }  // Good
function fetchData(callback) { }  // Avoid
```

#### Type Organization

- **Co-located types** for module-specific types
- **Central types** (`/types/`) for shared, cross-cutting types
- Use `.types.ts` suffix for type-only files

```typescript
// Co-located (preferred for module-specific)
src/services/domain/email-domain.service.ts
src/services/domain/email-domain.types.ts

// Centralized (for shared types)
src/types/api/api-client.types.ts
```

#### Type Safety Best Practices

```typescript
// ✅ Good: Branded types for primitive wrappers
type UserId = string & { readonly __brand: 'UserId' };

// ✅ Good: Interfaces for objects
interface UserData {
  id: string;
  email: string;
}

// ✅ Good: Discriminated unions
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: Error };

// ✅ Good: Explicit return types
function getUser(id: string): Promise<User> { }

// ❌ Avoid: Implicit any
function process(data) { }  // No type for data
```

### Import Patterns

#### Import Order

```typescript
// 1. External libraries
import express from 'express';
import { z } from 'zod';

// 2. Path aliases (if using)
import { ErrorFactory } from '@/errors';
import { logger } from '@/utils/logger';

// 3. Relative imports
import { EmailService } from './email.service';
import type { EmailOptions } from './email.types';
```

#### Path Aliases

The project supports path aliases for cleaner imports:

```typescript
// Instead of: import { ErrorFactory } from '../../../errors';
import { ErrorFactory } from '@/errors';

// Available aliases:
// @/*              - src root
// @/config/*       - Configuration
// @/services/*     - Services
// @/types/*        - Types
// @/utils/*        - Utilities
// @/errors/*       - Errors
// @/middleware/*   - Middleware
// @/routes/*       - Routes
// @/schemas/*      - Schemas
// @/layers/*       - Layers
// @/framework/*    - Framework
```

#### Barrel Exports

Use `index.ts` files for clean public APIs:

```typescript
// services/domain/index.ts
export { EmailDomainService } from './email-domain.service';
export type { EmailSearchOptions } from './email-domain.types';

// Usage
import { EmailDomainService } from '@/services/domain';
```

## Testing

### Test Structure

Tests should mirror the source structure:

```
src/services/domain/email-domain.service.ts
tests/unit/services/domain/email-domain.service.test.ts
```

### Running Tests

```bash
# Backend
cd backend

# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Writing Tests

```typescript
import { describe, it, expect } from '@jest/globals';
import { EmailDomainService } from '@/services/domain';

describe('EmailDomainService', () => {
  it('should search emails successfully', async () => {
    // Arrange
    const service = new EmailDomainService();

    // Act
    const result = await service.searchEmails({ query: 'test' });

    // Assert
    expect(result.success).toBe(true);
  });
});
```

## Git Workflow

### Branch Naming

```
feature/add-email-search
fix/authentication-bug
refactor/reorganize-services
docs/update-contributing
```

### Commit Messages

Follow the conventional commits specification:

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `docs`: Documentation changes
- `test`: Adding/updating tests
- `chore`: Maintenance tasks
- `style`: Code style changes (formatting)
- `perf`: Performance improvements

**Examples:**

```bash
feat(email): add email search functionality

Implemented email search with support for:
- Keyword matching
- Date range filtering
- Sender/recipient filtering

Closes #123

---

fix(auth): resolve token expiration issue

Fixed a bug where tokens were not being refreshed
properly, causing users to be logged out prematurely.

---

refactor(services): standardize file naming conventions

Renamed middleware and util files to follow naming standards:
- errorHandler.ts → error-handler.middleware.ts
- requestLogger.ts → request-logger.middleware.ts
- type-guards.ts → type-guards.util.ts
```

### Pull Requests

**PR Title:** Follow commit message format

**PR Description Template:**
```markdown
## Summary
Brief description of changes

## Changes Made
- Change 1
- Change 2

## Testing
How the changes were tested

## Related Issues
Closes #123
```

## Documentation

### Code Documentation

Use JSDoc for public APIs:

```typescript
/**
 * Search emails based on provided criteria
 *
 * @param options - Search options including query, filters, pagination
 * @returns Promise resolving to search results
 * @throws {ValidationError} If search options are invalid
 * @throws {APIClientError} If API request fails
 *
 * @example
 * ```typescript
 * const results = await service.searchEmails({
 *   query: 'meeting notes',
 *   dateRange: { start: '2024-01-01', end: '2024-01-31' }
 * });
 * ```
 */
async function searchEmails(options: EmailSearchOptions): Promise<SearchResults> {
  // Implementation
}
```

### Architecture Documentation

For architectural decisions, create ADRs (Architecture Decision Records) in `backend/docs/adr/`:

```markdown
# ADR-001: Use Layered Architecture

## Status
Accepted

## Context
Need to organize complex business logic...

## Decision
Implement 3-layer architecture...

## Consequences
- Pros: Clear separation, testability
- Cons: Initial complexity
```

## Additional Resources

- [Architecture Documentation](./backend/docs/architecture/)
- [Naming Conventions](./backend/docs/architecture/naming-conventions.md)
- [Types Organization](./backend/docs/architecture/types-organization.md)
- [Folder Structure](./backend/docs/architecture/folder-structure.md)

## Questions?

If you have questions or need clarification on any of these guidelines, please:
1. Check the [Architecture Documentation](./backend/docs/architecture/)
2. Open an issue for discussion
3. Ask in pull request comments

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
