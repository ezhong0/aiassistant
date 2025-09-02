# OAuth Token Persistence Issue - Diagnosis & Solutions

## 🚨 **Problem: Re-authentication Required After Every Redeploy**

**Issue**: You have to re-authenticate with Gmail every time you redeploy the application.

## 🔍 **Root Cause Analysis**

### **Primary Cause: Database Connection Issues**

The most likely cause is that the database connection is failing, causing OAuth tokens to fall back to in-memory storage, which is lost on redeploy.

**Evidence from Code Analysis:**
```typescript
// In SessionService.storeOAuthTokens()
if (this.databaseService && tokens.google) {
  // Store in database (persistent)
  await this.databaseService.storeOAuthTokens(tokenData);
} else if (this.sessions) {
  // Fallback to in-memory storage (lost on restart)
  session.oauthTokens.google = tokens.google;
}
```

### **Database URL Issue**

Your current `DATABASE_URL`:
```
postgresql://postgres:LGdfoNzzLPFWGpgofUejhpiEpbDNRXzk@postgres.railway.internal:5432/railway
```

**Problem**: `postgres.railway.internal` is only accessible from within Railway's infrastructure.

- ✅ **Works**: When deployed to Railway
- ❌ **Fails**: When running locally or during deployment process
- **Result**: Falls back to in-memory storage, tokens lost on redeploy

## 🛠️ **Solutions**

### **Solution 1: Use Public Database URL (Recommended)**

1. **Get Public Database URL from Railway Dashboard:**
   - Go to your Railway dashboard
   - Navigate to your PostgreSQL database
   - Click "Connect" → "External"
   - Copy the public connection string

2. **Update Environment Variables:**
   ```bash
   # For local development and deployment
   DATABASE_URL=postgresql://postgres:LGdfoNzzLPFWGpgofUejhpiEpbDNRXzk@containers-us-west-XX.railway.app:XXXX/railway
   ```

3. **Test Database Connection:**
   ```bash
   cd backend
   npx ts-node scripts/test-database-connection.ts
   ```

### **Solution 2: Enhanced Logging (Already Implemented)**

I've added comprehensive logging to help diagnose the issue:

**Session Service Initialization:**
```typescript
if (!this.databaseService) {
  this.logWarn('⚠️  OAuth tokens will NOT persist across server restarts!');
} else {
  this.logInfo('✅ Database service available for persistent OAuth token storage');
}
```

**OAuth Token Storage:**
```typescript
this.logInfo('✅ Stored Google OAuth tokens in database', { 
  sessionId, 
  databaseService: this.databaseService.constructor.name,
  databaseState: this.databaseService.state
});
```

**OAuth Token Retrieval:**
```typescript
this.logDebug('✅ Retrieved OAuth tokens from database', {
  sessionId,
  hasAccessToken: !!tokenData.accessToken,
  expiresAt: tokenData.expiresAt.toISOString()
});
```

### **Solution 3: Check Application Logs**

After implementing the enhanced logging, check your application logs for these messages:

**✅ Good Signs:**
- `"✅ Database service available for persistent OAuth token storage"`
- `"✅ Stored Google OAuth tokens in database"`
- `"✅ Retrieved OAuth tokens from database"`

**❌ Problem Signs:**
- `"⚠️ OAuth tokens will NOT persist across server restarts!"`
- `"❌ Failed to store OAuth tokens in database"`
- `"Using in-memory storage for OAuth tokens"`

### **Solution 4: Database Schema Verification**

Run the database setup script to ensure tables exist:

```bash
cd backend
npm run db:setup
```

Expected output:
```
✅ Sessions table created/verified
✅ OAuth tokens table created/verified
✅ Slack workspaces table created/verified
✅ Slack users table created/verified
```

## 🧪 **Testing & Verification**

### **Test 1: Database Connection**
```bash
cd backend
npx ts-node scripts/test-database-connection.ts
```

### **Test 2: OAuth Flow**
1. Deploy to Railway
2. Authenticate with Gmail
3. Check logs for database storage messages
4. Redeploy
5. Try to send an email
6. Should NOT require re-authentication

### **Test 3: Session ID Consistency**

The system generates session IDs like:
- `slack_${teamId}_${userId}_main`
- `slack_${teamId}_${userId}_thread_${threadTs}`
- `slack_${teamId}_${userId}_channel_${channelId}`

Ensure these are consistent across deployments.

## 📋 **Checklist**

- [ ] **Database URL**: Using public Railway URL (not internal)
- [ ] **Database Connection**: Test script passes
- [ ] **Database Schema**: All tables created
- [ ] **Application Logs**: Show database storage messages
- [ ] **OAuth Flow**: Tokens persist after redeploy

## 🔧 **Quick Fix Steps**

1. **Get Public Database URL** from Railway dashboard
2. **Update DATABASE_URL** in your environment variables
3. **Test Database Connection** with the test script
4. **Redeploy** your application
5. **Authenticate** with Gmail
6. **Verify** tokens persist after another redeploy

## 📊 **Expected Behavior After Fix**

1. **First Authentication**: User authenticates, tokens stored in database
2. **Redeploy**: Application restarts, database connection established
3. **Subsequent Requests**: Tokens retrieved from database, no re-authentication needed
4. **Persistence**: Tokens survive multiple redeploys

## 🚀 **Deployment Notes**

- **Railway**: Database will be accessible from within Railway's infrastructure
- **Local Development**: Use public database URL for testing
- **Environment Variables**: Ensure DATABASE_URL is set in Railway environment
- **Logs**: Monitor for database connection and storage messages

The enhanced logging will help you identify exactly where the issue is occurring and ensure OAuth tokens persist properly across deployments.
