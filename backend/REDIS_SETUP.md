# Redis Setup for Railway Deployment

This guide explains how to fix Redis connection issues on Railway and set up Redis properly for your application.

## 🎯 Problem

Your application was experiencing Redis connection errors (ECONNREFUSED) when deployed to Railway because:
1. No Redis service was provisioned on Railway
2. The application was trying to connect to `redis://localhost:6379` in production
3. Missing Redis environment variables

## ✅ Solution Implemented

### 1. Enhanced Redis Configuration

**File: `src/services/cache.service.ts`**
- Added support for multiple Railway Redis environment variable names
- Improved error handling and connection resilience
- Added graceful degradation when Redis is unavailable
- Enhanced logging for debugging

### 2. Smart Service Registration  

**File: `src/services/service-initialization.ts`**
- CacheService only registers when Redis config is available
- Prevents connection attempts without proper configuration
- Logs available environment variables for debugging

### 3. Redis Testing Script

**File: `scripts/test-redis.ts`**
- Test Redis connectivity: `npm run redis:test`
- Debug environment variables
- Validate Redis operations

## 🚀 Railway Setup Instructions

### Step 1: Add Redis Service to Railway

1. Go to your Railway project dashboard
2. Click "Add Service" or "New"
3. Select "Database" → "Redis"
4. Railway will provision a Redis instance and set environment variables

### Step 2: Verify Environment Variables

After adding Redis, Railway automatically sets these variables:
- `REDIS_URL` - Primary connection URL
- `REDIS_PRIVATE_URL` - Internal network URL (preferred)
- `REDIS_PUBLIC_URL` - Public network URL

### Step 3: Deploy and Test

1. Deploy your updated application to Railway
2. Check logs to see Redis connection status
3. Test the connection using: `npm run redis:test`

## 🔧 Local Development

### Option 1: Use Railway Redis (Recommended)
```bash
# Get Railway environment variables
railway variables

# Run locally with Railway variables
railway run npm run dev
```

### Option 2: Local Redis
```bash
# Install Redis locally (macOS)
brew install redis
brew services start redis

# Or use Docker
docker run -d -p 6379:6379 redis:alpine

# Set environment variable
export REDIS_URL=redis://localhost:6379
npm run dev
```

### Option 3: Disable Redis
```bash
# Skip Redis entirely
export DISABLE_REDIS=true
npm run dev
```

## 📋 Testing

### Test Redis Connection
```bash
npm run redis:test
```

Expected output with Redis configured:
```
✅ Connected to Redis!
✅ SET operation successful
✅ GET operation successful
✅ DELETE operation successful
✅ Redis server version: 7.x.x
✅ PING successful
```

### Test Application Startup
```bash
npm run dev
```

Look for these log messages:
```
[INFO] CacheService registered { hasRedisConfig: true, nodeEnv: 'development' }
[INFO] Redis client connected and ready
[INFO] CacheService initialized successfully
```

## 🔍 Troubleshooting

### Railway Redis Not Working

1. **Check if Redis service exists:**
   - Go to Railway dashboard
   - Verify Redis service is listed and running

2. **Check environment variables:**
   ```bash
   railway variables | grep -i redis
   ```

3. **Check logs:**
   ```bash
   railway logs
   ```

### Local Redis Issues

1. **Connection refused:**
   ```bash
   # Check if Redis is running
   redis-cli ping
   
   # Start Redis if needed
   brew services start redis
   # or
   docker run -d -p 6379:6379 redis:alpine
   ```

2. **Wrong URL format:**
   ```bash
   # Correct format
   export REDIS_URL=redis://localhost:6379
   # Not: localhost:6379
   ```

### Application Issues

1. **Graceful Degradation:**
   - If Redis is unavailable, the app continues without caching
   - Check logs for: "Redis unavailable - continuing without cache functionality"

2. **Service Registration:**
   - CacheService only registers when Redis config is available
   - Check logs for: "CacheService skipped - no Redis configuration found"

## 📈 Benefits of This Fix

### ✅ Production Ready
- No more ECONNREFUSED errors on Railway
- Proper environment variable detection
- Graceful degradation when Redis unavailable

### ✅ Development Friendly
- Works with or without Redis
- Easy local development setup
- Clear error messages and debugging info

### ✅ Robust Connection Handling
- Longer timeouts for cloud environments
- Exponential backoff retry strategy
- Proper cleanup on connection failures

## 🎯 Quick Commands

```bash
# Test Redis connection
npm run redis:test

# Run with Railway environment
railway run npm run dev

# Disable Redis for testing
DISABLE_REDIS=true npm run dev

# Check Railway variables
railway variables | grep -i redis
```

## 🔄 Migration Guide

Your existing Redis setup will automatically work with these changes:

1. **If you have Redis configured:** Application will connect normally
2. **If Redis is unavailable:** Application will continue without caching
3. **If Redis fails:** Application will retry then gracefully degrade

No code changes needed in your agents or other services - the CacheService handles all Redis complexity internally.

---

**Your Redis connection issues are now fixed! 🎉**

The application will:
- ✅ Connect to Redis when properly configured on Railway
- ✅ Continue without Redis when unavailable (graceful degradation)
- ✅ Provide clear logs for debugging
- ✅ Handle connection failures robustly