# Naming Conventions

## File Naming Standards

All files should follow consistent naming patterns for easy navigation and understanding.

### Backend (TypeScript)

| Type | Pattern | Example |
|------|---------|---------|
| Services | `[name].service.ts` | `email-domain.service.ts` |
| Middleware | `[name].middleware.ts` | `error-handler.middleware.ts` |
| Routes | `[name].routes.ts` | `protected.routes.ts` |
| Types | `[name].types.ts` | `api-client.types.ts` |
| Schemas | `[name].schemas.ts` | `contact.schemas.ts` |
| Utils | `[name].util.ts` | `validation.util.ts` |
| Constants | `[name].constants.ts` or `[name].ts` | `oauth-scopes.ts` |
| Errors | `[name]-errors.ts` or `[name].ts` | `specialized-errors.ts` |
| Config | `[name].config.ts` or `[name]-config.ts` | `agent-config.ts` |

### Frontend (React Native / TypeScript)

| Type | Pattern | Example |
|------|---------|---------|
| React Components | `PascalCase.tsx` | `WelcomeScreen.tsx` |
| Hooks | `use[Name].ts` | `useAuth.ts` |
| Utils | `[name]Utils.ts` or `[name].util.ts` | `messageUtils.ts` |
| Services | `[name].service.ts` | `api.service.ts` |
| Types | `[name].types.ts` or `index.ts` | `types/index.ts` |
| Styles | `[name].styles.ts` | `button.styles.ts` |

### Configuration Files

| Type | Pattern | Example |
|------|---------|---------|
| TypeScript Config | `tsconfig[.variant].json` | `tsconfig.prod.json` |
| Jest Config | `jest[.variant].config.js` | `jest.e2e.config.js` |
| ESLint Config | `eslint.config[.variant].js` | `eslint.config.strict.js` |
| Tool Config | `[tool].config.[js\|ts]` | `tailwind.config.js` |

## Directory Naming

### General Rules
- Use **kebab-case** for all directories
- Be descriptive but concise
- Group related files logically

### Backend Structure
```
src/
├── config/              # Configuration and constants
├── constants/           # Application constants
├── di/                  # Dependency injection
│   └── registrations/   # DI service registrations
├── docs/                # API documentation (Swagger)
├── errors/              # Error classes and utilities
├── framework/           # Framework-level abstractions
├── layers/              # 3-layer architecture
│   ├── layer1-decomposition/
│   ├── layer2-execution/
│   └── layer3-synthesis/
├── middleware/          # Express middleware
├── routes/              # API route handlers
│   └── auth/
│       └── debug/
├── schemas/             # Zod validation schemas
├── services/            # Business logic services
│   ├── api/             # External API clients
│   │   └── clients/
│   └── domain/          # Domain services
│       ├── interfaces/
│       └── strategies/
├── templates/           # Email/HTML templates
├── types/               # Shared TypeScript types
│   └── api/
├── utils/               # Utility functions
└── validation/          # Validation utilities
```

### Frontend Structure
```
src/
├── components/          # React components
│   ├── messages/        # Message components
│   ├── onboarding/      # Onboarding flow
│   └── examples/        # Example/demo components
├── config/              # Configuration
├── design-system/       # Design system
│   └── components/      # Design system components
├── services/            # API and business logic
├── types/               # TypeScript types
└── utils/               # Utility functions
```

### Test Structure
Tests should mirror the `src/` structure:
```
tests/
├── unit/                # Unit tests (mirrors src/)
│   ├── services/
│   └── middleware/
├── integration/         # Integration tests
├── e2e/                 # End-to-end tests
│   ├── scenarios/
│   ├── generators/
│   └── evaluators/
└── utils/               # Test utilities
```

## Variable & Function Naming

### TypeScript/JavaScript

```typescript
// Classes: PascalCase
class EmailDomainService { }
class APIClientError { }

// Interfaces: PascalCase with 'I' prefix (optional)
interface EmailSearchOptions { }
interface IUserService { }  // Optional I prefix for clarity

// Types: PascalCase
type UserRole = 'admin' | 'user';
type Result<T> = { success: boolean; data: T };

// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 5000;

// Enums: PascalCase for enum, UPPER_SNAKE_CASE for values
enum ErrorCategory {
  SERVICE_ERROR = 'SERVICE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

// Functions: camelCase
function validateEmail(email: string): boolean { }
async function fetchUserData(userId: string): Promise<User> { }

// Variables: camelCase
const userEmail = 'user@example.com';
let requestCount = 0;

// Private class members: camelCase with _ prefix (optional)
class Service {
  private _cache: Map<string, any>;
  private readonly _config: Config;
}

// Boolean variables/functions: is/has/should prefix
const isValid = true;
const hasPermission = false;
function shouldRetry(): boolean { }

// Event handlers: handle/on prefix
function handleClick() { }
function onUserLogin() { }

// Async functions: use async/await, not callbacks
async function fetchData() { }  // Good
function fetchData(callback) { }  // Avoid
```

### React Components

```typescript
// Components: PascalCase
export const Button: React.FC<ButtonProps> = () => { };
export const UserProfile: React.FC = () => { };

// Props interfaces: ComponentNameProps
interface ButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

// Hooks: use prefix
const useAuth = () => { };
const useLocalStorage = (key: string) => { };

// Event handlers: handle prefix
const handleSubmit = () => { };
const handleInputChange = (e: Event) => { };

// State variables: descriptive names
const [isLoading, setIsLoading] = useState(false);
const [userData, setUserData] = useState<User | null>(null);
```

## Import/Export Naming

### Barrel Exports (index.ts)
```typescript
// Use named exports for clarity
export { EmailDomainService } from './email-domain.service';
export { CalendarDomainService } from './calendar-domain.service';

// Export types separately
export type { EmailSearchOptions } from './email-domain.types';
export type { CalendarEvent } from './calendar-domain.types';
```

### Import Patterns
```typescript
// Prefer named imports
import { EmailDomainService } from './services/domain';
import { ERROR_CODES } from './errors';

// Group imports logically
// 1. External libraries
import express from 'express';
import { z } from 'zod';

// 2. Internal modules (absolute)
import { ErrorFactory } from '@/errors';
import { logger } from '@/utils/logger';

// 3. Relative imports
import { EmailService } from './email.service';
import type { EmailOptions } from './email.types';
```

## Exceptions to Rules

### Legacy Files
Some files may not follow these conventions due to historical reasons:
- `logger.ts` (not `logger.util.ts`) - Core infrastructure
- `app-error.ts` (in `/utils/` but defines error classes)

These are acceptable but new files should follow the standard conventions.

### Third-Party Conventions
When integrating with third-party libraries, follow their conventions:
- Jest: `*.test.ts` or `*.spec.ts`
- React: `.tsx` for components, `.ts` for logic
- Config files: Follow tool conventions (e.g., `jest.config.js`)

## Refactoring Guidelines

When refactoring to follow naming conventions:
1. Use `git mv` to preserve history
2. Update all imports in the same commit
3. Run type checking and tests
4. Update documentation

Example:
```bash
git mv errorHandler.ts error-handler.middleware.ts
# Update imports
npm run typecheck
npm run test
```

## See Also
- [Types Organization](./types-organization.md)
- [Folder Structure](./folder-structure.md)
- [Import Patterns](./import-patterns.md)
