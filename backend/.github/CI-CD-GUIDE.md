# CI/CD Pipeline Guide

## Overview

This document describes the Continuous Integration and Continuous Deployment (CI/CD) pipeline for the assistantapp backend.

## Pipeline Architecture

### Workflows

#### 1. Main CI Pipeline (`ci.yml`)
Runs on push to `main`/`develop` and all pull requests.

**Jobs:**

1. **Lint & Code Quality** (3-5 min)
   - ESLint checks
   - Prettier formatting validation
   - Custom ESLint rules (DI, error handling, architecture)

2. **TypeScript Type Check** (2-3 min)
   - Full TypeScript compilation check
   - No emit, just validation
   - Catches type errors before runtime

3. **Security Scan** (2-4 min)
   - Gitleaks secret detection
   - npm audit for dependency vulnerabilities
   - Custom security ESLint rules

4. **Unit Tests** (3-5 min)
   - Fast, isolated tests
   - No external dependencies
   - Runs in parallel with other jobs
   - Uploads coverage reports

5. **Integration Tests** (5-10 min)
   - Tests with PostgreSQL and Redis services
   - Database migrations
   - Real service interactions

6. **Build Verification** (2-3 min)
   - Production build compilation
   - Ensures deployable artifact
   - Uploads build artifacts

7. **Test Summary**
   - Aggregates all results
   - Provides single pass/fail status

#### 2. PR Checks (`pr-checks.yml`)
Fast checks for pull requests to provide quick feedback.

**Jobs:**

1. **Quick Checks** (2-3 min)
   - Error-level linting only
   - Security and architecture validation
   - Type checking
   - Fails fast on critical issues

2. **PR Size Check**
   - Warns on large PRs (>50 files or >1000 lines)
   - Encourages smaller, focused PRs

3. **Comment Results**
   - Posts CI status as PR comment
   - Provides quick visibility

## Security

### Gitleaks Configuration

Gitleaks scans for secrets in the codebase:

- **Configured via**: `.gitleaks.toml`
- **Allowlisted files**: `.env.test` (contains only test placeholders)
- **Custom rules**: Detects production env files, real API keys

### Allowed Test Files

The following files can contain test credentials:
- `.env.test` - Test environment variables (no real secrets)
- `tests/*/fixtures/*` - Test data fixtures
- `tests/*/mocks/*` - Mock data

### NPM Audit

- Runs on every commit
- Fails on `moderate` severity or higher
- Configured as `continue-on-error` to warn but not block

## Testing Strategy

### Test Categories

1. **Unit Tests** (`npm run test:unit`)
   - Services, utilities, helpers
   - Fully mocked dependencies
   - Fast execution (<5 min)
   - No external services

2. **Integration Tests** (`npm run test:integration`)
   - Database interactions
   - Redis caching
   - Service-to-service communication
   - Requires PostgreSQL + Redis

3. **E2E Tests** (not in CI yet)
   - Full application flows
   - External API interactions
   - Long-running tests
   - Run separately or on-demand

### Test Configuration

#### Jest Settings

- **Detect Open Handles**: Enabled to catch async leaks
- **Force Exit**: Disabled to ensure proper cleanup
- **Global Setup**: `tests/setup.ts` for cleanup utilities
- **Memory Limit**:
  - Unit: 128MB
  - E2E: 256MB

#### Common Test Issues

**Async Operation Leaks**:
- Use `cleanup.clearAllTimers()` in tests
- Always call `destroy()` on services in `afterEach`
- Avoid hanging promises

**Memory Issues**:
- Tests run with `--expose-gc` flag
- Memory limits configured per test type
- Use `--runInBand` to prevent parallel execution issues

## Local Development

### Pre-commit Hooks (Husky)

Runs automatically on `git commit`:

```bash
# Via lint-staged:
1. ESLint --fix on *.ts
2. Prettier --write on *.ts
3. npm audit on package*.json
4. gitleaks protect --staged on all files
```

### Manual Checks

Run these before pushing:

```bash
# Quick validation
npm run lint
npm run typecheck
npm run test:unit

# Full validation (same as CI)
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run build

# Security checks
npm run lint:security
npm run lint:architecture
npm audit
```

### Faster Feedback Loop

```bash
# Run only changed tests
npm run test:watch

# Run specific test file
npm run test -- path/to/test.test.ts

# Run fast simple tests
npm run test:fast
```

## CI/CD Best Practices

### Writing CI-Friendly Tests

✅ **Do:**
- Clean up resources in `afterEach`/`afterAll`
- Use proper mocking for external services
- Keep tests independent and isolated
- Use `cleanup.clearAllTimers()` from `tests/setup.ts`
- Test one thing per test case

❌ **Don't:**
- Leave open database connections
- Use `setTimeout` without cleanup
- Share state between tests
- Mock the entire DI container
- Use real API keys

### Optimizing CI Performance

1. **Parallel Jobs**: Jobs run in parallel when possible
2. **Caching**: npm dependencies cached between runs
3. **Artifacts**: Build outputs cached for 7 days
4. **Fail Fast**: Critical checks (lint, typecheck) fail quickly
5. **Test Splitting**: Unit and integration tests separated

### Debugging CI Failures

#### Lint Failures
```bash
# Run locally with same config
npm run lint

# Auto-fix issues
npm run lint:fix
```

#### Type Errors
```bash
# Check types locally
npm run typecheck

# Watch mode for iterative fixes
npx tsc --noEmit --watch
```

#### Test Failures
```bash
# Run with same settings as CI
npm run test:unit

# Enable verbose output
npm run test:unit -- --verbose

# Detect async leaks locally
npm run test:unit -- --detectOpenHandles
```

#### Security Failures
```bash
# Check for secrets (requires gitleaks binary)
gitleaks detect --source . --verbose

# Or use Docker
docker run -v $(pwd):/path zricethezav/gitleaks:latest detect --source="/path" --verbose

# Check npm vulnerabilities
npm audit
npm audit --audit-level=moderate
```

## GitHub Actions Secrets

No secrets required for CI. External service tests use mocks.

For production deployment (future):
- `SENTRY_DSN`
- `RAILWAY_TOKEN` (if using Railway)
- Database credentials (injected by hosting platform)

## Maintenance

### Updating Dependencies

```bash
# Check for updates
npm outdated

# Update with audit
npm update
npm audit fix

# Verify CI still passes
npm run lint && npm run typecheck && npm run test:unit
```

### Adding New CI Checks

1. Add script to `package.json`
2. Add job/step to `.github/workflows/ci.yml`
3. Test locally first
4. Update this documentation

## Metrics

Target CI performance:
- **PR Checks**: < 5 minutes
- **Full CI**: < 20 minutes
- **Build Time**: < 3 minutes
- **Test Coverage**: > 70% (future goal)

## Troubleshooting

### CI Hangs or Times Out

- Check for async operations not being cleaned up
- Review test logs for `detectOpenHandles` warnings
- Verify all services call `destroy()` in cleanup

### Flaky Tests

- Tests should be deterministic and isolated
- Avoid time-dependent tests
- Use mocks for external services
- Increase timeout if legitimately slow

### Memory Issues

- Check memory limits in `jest.config.js`
- Use `--expose-gc` flag
- Profile tests with `--logHeapUsage`

## Future Improvements

- [ ] Add test coverage reporting and enforcement
- [ ] Deploy preview environments for PRs
- [ ] Performance regression testing
- [ ] Visual regression testing
- [ ] Automated dependency updates (Dependabot/Renovate)
- [ ] Deploy to staging/production automation
- [ ] Slack/Discord notifications for CI failures
- [ ] Parallel test execution (when stable)
