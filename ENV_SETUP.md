# Environment Setup

## Quick Start

```bash
# 1. Copy the example file
cp .env.example .env

# 2. Fill in your actual values (see .env.example for all variables)

# 3. Generate secrets
openssl rand -hex 64  # For JWT_SECRET
openssl rand -base64 32  # For TOKEN_ENCRYPTION_KEY

# 4. Start backend
cd backend && npm run dev  # Validates config on startup
```

## Production Requirements

**Critical:**
- `NODE_ENV=production`
- `SECURITY_CORS_ORIGIN` must be explicit (not `*`)
- Strong secrets (64+ chars for JWT_SECRET)
- All API keys configured

**Backend validates on startup** - Server won't start if config is invalid.

## TypeScript Configuration

**Phase 1 Complete:** ✅ `noImplicitAny` + `noImplicitReturns` enabled
- Catches untyped parameters at compile time
- All code paths must return values
- ~Zero type errors in build

**Next:** Phase 2 (`strictNullChecks`) requires ~40 fixes - see `backend/tsconfig.strict.json` for goal state.

## Code Standards

- **Error Handling:** Use `ErrorFactory` - never throw raw `Error`
- **Configuration:** Use `UnifiedConfigService` - never access `process.env` directly
- **Logging:** All logs include request ID via `createLogContext(req)`
- **Services:** Extend `BaseService` for lifecycle management
- **DI:** Constructor injection via Awilix - no service locator pattern
