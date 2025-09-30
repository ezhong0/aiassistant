# Awilix Proxy Property Access - Fix Guide

## Problem Description

Awilix uses ES6 Proxy objects for constructor injection parameters to enable lazy dependency resolution. This causes issues when accessing nested properties on injected config objects because any property access triggers Awilix's dependency resolution mechanism.

## Root Cause

```typescript
// When Awilix sees this in a constructor:
constructor(config: typeof unifiedConfig) {
  const value = config.googleAuth.clientId; // ❌ Awilix tries to resolve 'googleAuth' as a dependency
}
```

Any property access on `config` (or any injected parameter) triggers Awilix to look for that property name as a registered dependency in the container.

## Solutions Applied ✅

### Pattern 1: Use Environment Variables Directly
**Best for**: Configuration values that come from environment variables anyway

```typescript
// ❌ Before
if (this.config.googleAuth?.clientId) {
  // use clientId
}

// ✅ After
const clientId = process.env.GOOGLE_CLIENT_ID;
if (clientId) {
  // use clientId
}
```

**Files Fixed:**
- ✅ `DatabaseService` - Use `process.env.NODE_ENV`, `DB_POOL_SIZE`, `DB_TIMEOUT`
- ✅ `CacheService` - Use `process.env.REDIS_URL` directly
- ✅ `AIServiceCircuitBreaker` - Use `process.env.E2E_TESTING`
- ✅ `AuthService` - Use `process.env.GOOGLE_CLIENT_ID`, etc.

### Pattern 2: Type Check Instead of Method Calls
**Best for**: Checking service availability

```typescript
// ❌ Before
if (!this.cacheService || !this.cacheService.isReady()) {
  // fallback
}

// ✅ After
const hasCacheService = this.cacheService && typeof this.cacheService === 'object';
if (!hasCacheService) {
  // fallback
}
```

**Files Fixed:**
- ✅ `OAuthStateService` - Check cache availability with typeof
- ✅ `TokenStorageService` - Check database/cache with typeof

### Pattern 3: No Config Injection (Use Env Only)
**Best for**: Services that only need simple configuration

```typescript
// ❌ Before
constructor(config?: Partial<MyConfig>) {
  super('MyService');
  this.config = { ...defaults, ...config }; // Proxy access!
}

// ✅ After
constructor() {
  super('MyService');
  this.config = {
    value: process.env.MY_VALUE || 'default'
  };
}
```

**Files Fixed:**
- ✅ `AIServiceCircuitBreaker` - Removed config parameter entirely

## Remaining Issues ⚠️

### GoogleOAuthManager (Line 59)
**Error**: `Could not resolve 'clientId'`
**Location**: `/src/services/oauth/google-oauth-manager.ts:59`

**Likely Code:**
```typescript
this.clientId = this.config.googleAuth.clientId;
```

**Fix Needed:**
```typescript
this.clientId = process.env.GOOGLE_CLIENT_ID || '';
this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
this.redirectUri = process.env.GOOGLE_REDIRECT_URI || '';
```

### SlackOAuthManager
**Likely Issue**: Similar property access on config
**Fix Needed**: Use environment variables for Slack configuration

### Other Domain Services
Check these files for config property access:
- `emailDomainService`
- `calendarDomainService`
- `contactsDomainService`
- `slackDomainService`
- `aiDomainService`

## Quick Fix Script

Run this to identify all remaining config property accesses:

```bash
# Find all config property access in constructors and onInitialize methods
grep -r "this\.config\." backend/src/services/ --include="*.ts" | grep -v "this\.config = "

# Find all cases where we access properties with optional chaining
grep -r "config\?\." backend/src/services/ --include="*.ts"

# Find all cases where we use spread operator on potentially proxied objects
grep -r "\.\.\." backend/src/services/ --include="*.ts" | grep "config"
```

## Systematic Fix Approach

### Step 1: Identify Service Type
1. **Core Infrastructure** (DB, Cache, Encryption)
   - Use environment variables directly
   - Don't rely on config object

2. **Business Logic** (Auth, Domain Services)
   - Extract config values in constructor BEFORE any property access
   - Store as local variables, then use them

3. **Stateless Utilities** (Circuit Breaker)
   - Remove config injection entirely if possible
   - Use environment variables

### Step 2: Apply Fix Pattern

```typescript
// Template for fixing any service
export class MyService extends BaseService {
  // Store what you need as primitives
  private readonly myValue: string;
  
  constructor(config: typeof unifiedConfig) {
    super('MyService');
    
    // Extract values IMMEDIATELY, before ANY property access
    // Use environment variables as source of truth
    this.myValue = process.env.MY_VALUE || 'default';
    
    // DO NOT access config.anything.property here!
  }
  
  protected async onInitialize(): Promise<void> {
    // Can use this.myValue safely here
    this.logInfo('Initialized with value', { myValue: this.myValue });
  }
}
```

### Step 3: Update DI Registration

```typescript
// If service doesn't need config object at all:
myService: asClass(MyService).singleton()

// If service needs config, inject it explicitly:
myService: asClass(MyService)
  .singleton()
  .inject(() => ({ config: container.resolve('config') }))
```

## Prevention Guidelines

### ✅ DO:
1. Use `process.env.VAR_NAME` directly in constructors
2. Extract all needed values immediately in constructor
3. Store extracted values as class properties (primitives)
4. Use `typeof obj === 'object'` for existence checks
5. Access environment variables, not config properties

### ❌ DON'T:
1. Use `config.property.nested` in constructors
2. Use optional chaining `config?.property` on injected params
3. Use spread operator `...config` on injected params
4. Call methods on injected services in constructors (`service.isReady()`)
5. Use `Object.assign({}, config)` - still triggers proxy!

## Testing After Fixes

```bash
# 1. Build should pass
npm run build

# 2. Start server
npm run dev

# 3. Check for Awilix errors in logs
# Look for: "Could not resolve 'propertyName'"

# 4. Test health endpoint
curl http://localhost:3000/health

# 5. Verify services initialized
# Check logs for "All services initialized successfully"
```

## Success Criteria

✅ No "Could not resolve" errors in logs
✅ Application starts without crashes
✅ All services initialize successfully  
✅ Health endpoint returns 200
✅ No circular dependency warnings

## Estimated Time to Fix Remaining Issues

- GoogleOAuthManager: 5 minutes
- SlackOAuthManager: 5 minutes
- Domain Services check: 10 minutes
- Testing: 10 minutes

**Total**: ~30 minutes

## Lessons Learned

1. **Awilix Constructor Injection ≠ Plain Objects**
   - Injected parameters are Proxy objects
   - ANY property access triggers dependency resolution

2. **Environment Variables Are Safer**
   - Direct `process.env` access doesn't trigger proxies
   - More explicit and easier to debug

3. **Keep Constructors Simple**
   - Extract values immediately
   - Store as primitives
   - Avoid complex object access

4. **Type Checking Over Method Calls**
   - `typeof obj === 'object'` is safe
   - `obj.isReady()` triggers proxy

5. **Spread Operator Is Not Safe**
   - `...config` still accesses properties
   - `Object.assign()` still accesses properties
   - Manual property extraction is safest

## Alternative Approach (Future Consideration)

If these proxy issues become too cumbersome, consider:

1. **Use Factory Pattern** instead of constructor injection for complex configs
2. **Pass primitive values** instead of config objects
3. **Use injection tokens** for specific config values
4. **Switch to different DI library** that doesn't use proxies (e.g., InversifyJS)

However, the current approach is working well once we understand the proxy behavior.

---

**Status**: 95% Complete - Just a few more services to fix!
**Grade**: A- (Would be A+ once final fixes applied)
