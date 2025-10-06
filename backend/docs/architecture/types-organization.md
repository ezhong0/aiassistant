# Types Organization Strategy

## Overview

This document outlines the strategy for organizing TypeScript types and interfaces across the codebase.

## Principles

### 1. Co-location for Module-Specific Types
Module-specific types should be co-located with the code that uses them.

**Example:**
```
src/services/domain/email-domain.service.ts
src/services/domain/email-domain.types.ts  ← Co-located types
```

### 2. Centralized Shared Types
Cross-cutting types used by multiple modules belong in `/src/types/`.

**Current Structure:**
```
src/types/
├── api/                    # API-related types
│   ├── api.types.ts
│   ├── api-client.types.ts
│   └── retry-strategy.types.ts
├── calendar/               # Calendar domain types
│   └── index.ts
├── auth.types.ts           # Authentication types
├── service.types.ts        # Service interfaces
└── branded-types.ts        # Type safety utilities
```

### 3. Type File Naming Convention
- Use `.types.ts` suffix for type-only files
- Example: `email-domain.types.ts`, `api-client.types.ts`

## When to Use Each Approach

### Co-located Types (Preferred)
Use when:
- Types are specific to a single module
- Types are unlikely to be reused elsewhere
- Strong coupling with implementation

**Examples:**
- `orchestrator.types.ts` (next to `orchestrator.service.ts`)
- `execution.types.ts` (next to execution coordinator)
- `synthesis.types.ts` (next to synthesis service)

### Centralized Types
Use when:
- Types are shared across 3+ modules
- Types define cross-cutting concerns (API, auth, validation)
- Types are part of public interfaces

**Examples:**
- `src/types/api/` - Used by all API clients and consumers
- `src/types/auth.types.ts` - Used across routes, middleware, services
- `src/types/service.types.ts` - Base interfaces for all services

## Type Export Patterns

### Module-Specific Export
```typescript
// email-domain.service.ts
export class EmailDomainService { }

// email-domain.types.ts
export interface EmailSearchOptions { }
export type EmailFilter = { };
```

### Centralized Barrel Export
```typescript
// src/types/index.ts
export * from './api/api.types';
export * from './auth.types';
export type { ServiceInterface } from './service.types';
```

## Migration Guide

### Moving Types to Co-location
1. Create `.types.ts` file next to the implementation
2. Move module-specific types
3. Update imports in the module
4. Remove from central `/types/` if no longer shared

### Moving Types to Central Location
1. Identify types used by 3+ modules
2. Move to appropriate `/types/` subdirectory
3. Update all imports across codebase
4. Add to barrel export if public API

## Type Safety Best Practices

### 1. Use Branded Types for Primitive Wrappers
```typescript
// types/branded-types.ts
export type UserId = string & { readonly __brand: 'UserId' };
export type EmailId = string & { readonly __brand: 'EmailId' };
```

### 2. Prefer Interfaces for Objects, Types for Unions
```typescript
// Good
interface UserData {
  id: string;
  email: string;
}

type UserRole = 'admin' | 'user' | 'guest';

// Avoid
type UserData = {  // Use interface instead
  id: string;
};
```

### 3. Use Discriminated Unions for Variants
```typescript
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: Error };
```

## Current Type Organization Status

### ✅ Well-Organized
- API types in `types/api/`
- Co-located layer types (`orchestrator.types.ts`, `execution.types.ts`)
- Error types in `errors/` directory

### ⚠️ Could Improve
- Some types mixed between central and co-located
- Inconsistent barrel exports

## Future Improvements

1. **Type Documentation**: Add JSDoc comments to all public types
2. **Type Testing**: Consider using `tsd` for type-level tests
3. **Path Aliases**: Add `@types/*` path alias for easier imports
4. **Type Utilities**: Create common utility types in `types/utils.ts`

## See Also

- [Naming Conventions](./naming-conventions.md)
- [Folder Structure](./folder-structure.md)
- [Import Patterns](./import-patterns.md)
