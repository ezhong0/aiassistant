# External Setup Guide

This guide covers all setup steps that need to be done outside the codebase.

## Prerequisites

- Railway account (already deployed)
- Node.js and npm installed locally (for testing)

---

## Step 1: Create Supabase Project

### 1.1 Sign Up / Log In to Supabase

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in with GitHub (or create account)
3. Click "New Project"

### 1.2 Project Configuration

- **Name**: `assistantapp` (or your preferred name)
- **Database Password**: Generate a strong password (save this - you'll need it)
- **Region**: Choose closest to your Railway deployment (e.g., `us-east-1`)
- **Pricing Plan**: Free tier is sufficient to start

### 1.3 Get Supabase Credentials

Once project is created, go to **Settings → API**:

1. **Project URL**: Copy the URL (e.g., `https://xxxxx.supabase.co`)
2. **JWT Secret**: Under "JWT Settings", copy the secret (this verifies tokens)
3. **anon public key**: Copy the `anon` key (for client-side auth)

**Save these 3 values** - you'll add them to Railway environment variables.

---

## Step 2: Configure Supabase Authentication

### 2.1 Enable Google OAuth Provider

1. In Supabase, go to **Authentication → Providers**
2. Find **Google** and click to configure
3. Enable the provider

### 2.2 Get Google OAuth Credentials

You already have Google OAuth set up for Gmail/Calendar. Use the same credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to your existing project
3. Go to **APIs & Services → Credentials**
4. Find your OAuth 2.0 Client ID
5. Add Supabase redirect URI:
   ```
   https://YOUR_SUPABASE_PROJECT_URL/auth/v1/callback
   ```
   (Replace `YOUR_SUPABASE_PROJECT_URL` with your actual Supabase URL)

### 2.3 Configure Supabase with Google Credentials

Back in Supabase:

1. In the Google provider settings, enter:
   - **Client ID**: Your Google OAuth Client ID
   - **Client Secret**: Your Google OAuth Client Secret
2. Click **Save**

---

## Step 3: Add Railway Redis Addon

### 3.1 Install Redis Plugin

1. Go to your Railway project dashboard
2. Click **"+ New"** → **"Plugin"**
3. Select **Redis**
4. Click **"Add Plugin"**

Railway will automatically:
- Deploy a Redis instance
- Set environment variable `REDIS_URL` (or similar)

### 3.2 Verify Redis Connection

Railway will provide one of these environment variables:
- `REDIS_URL`
- `REDIS_PRIVATE_URL`
- `RAILWAY_REDIS_URL`

The backend code automatically checks for these (see `cache.service.ts`).

**Cost**: ~$3/month for 25MB

---

## Step 4: Update Railway Environment Variables

### 4.1 Add Supabase Variables

In Railway project settings → **Variables**, add:

```bash
# Supabase Authentication
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_JWT_SECRET=your-jwt-secret-from-supabase
SUPABASE_ANON_KEY=your-anon-key-from-supabase

# Redis is auto-configured by Railway plugin
# REDIS_URL is automatically set when you add the Redis plugin
```

### 4.2 Verify Existing Variables

Make sure these are still set (from your current deployment):

```bash
# OpenAI / Anthropic
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Google OAuth (for Gmail/Calendar API)
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REDIRECT_URI=https://your-backend.railway.app/auth/google/callback

# JWT (for internal use - keep existing)
JWT_SECRET=your-existing-jwt-secret

# Database (keep existing)
DATABASE_URL=postgresql://...
```

### 4.3 Add Node Environment

If not already set:

```bash
NODE_ENV=production
```

---

## Step 5: Deploy Backend Changes

### 5.1 Commit and Push

The backend code changes are already done. To deploy:

```bash
# From backend directory
git add .
git commit -m "feat: add Supabase auth and chat API"
git push origin main
```

Railway will automatically:
1. Detect the push
2. Build the new code
3. Deploy with new environment variables

### 5.2 Verify Deployment

Check Railway logs for:

```
✅ SessionManager initialized successfully
✅ Server started successfully
✅ Application routes configured
```

---

## Step 6: Test the Chat API

### 6.1 Get a Supabase Auth Token

**Option A: Using Supabase UI**

1. Go to **Authentication → Users** in Supabase
2. Click **"Add user"** → **"Create new user"**
3. Enter an email and password
4. Go to **Authentication → API Docs**
5. Use the "Sign in" example to get a JWT token

**Option B: Using cURL**

```bash
curl -X POST 'https://YOUR_SUPABASE_URL/auth/v1/signup' \
-H "apikey: YOUR_SUPABASE_ANON_KEY" \
-H "Content-Type: application/json" \
-d '{
  "email": "test@example.com",
  "password": "your_password"
}'
```

This returns:
```json
{
  "access_token": "eyJhbGc...",
  "user": { "id": "...", "email": "test@example.com" }
}
```

**Save the `access_token`** - this is your JWT.

### 6.2 Test Chat Endpoint

```bash
curl -X POST 'https://your-backend.railway.app/api/chat/message' \
-H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
-H "Content-Type: application/json" \
-d '{
  "message": "Hello! Can you help me?"
}'
```

Expected response:
```json
{
  "message": "Hello! I'm your AI assistant. I can help you with...",
  "session_id": "sess_abc-123-...",
  "metadata": {
    "processing_time": 1.234
  }
}
```

### 6.3 Test Multi-Turn Conversation

Use the `session_id` from the previous response:

```bash
curl -X POST 'https://your-backend.railway.app/api/chat/message' \
-H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
-H "Content-Type: application/json" \
-d '{
  "message": "What did I just ask you?",
  "session_id": "sess_abc-123-..."
}'
```

The AI should remember your previous message.

---

## Step 7: Frontend Integration (Optional)

### 7.1 Install Supabase Client

```bash
npm install @supabase/supabase-js
```

### 7.2 Initialize Supabase

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
```

### 7.3 Example: Sign In with Google

```javascript
// Trigger Google OAuth
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'http://localhost:3000/auth/callback'
  }
})

// After redirect, get session
const { data: { session } } = await supabase.auth.getSession()
const accessToken = session.access_token
```

### 7.4 Example: Chat API Call

```javascript
const response = await fetch('https://your-backend.railway.app/api/chat/message', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: 'Find my emails from Sarah',
    session_id: sessionId // optional, from previous response
  })
})

const data = await response.json()
console.log(data.message) // AI response
console.log(data.session_id) // Save for next turn
```

---

## Step 8: Cost Breakdown

### Current Monthly Costs

| Service | Cost | Notes |
|---------|------|-------|
| Railway Backend | $5-8 | Hobby plan |
| Railway Redis | $3 | 25MB addon |
| Supabase Auth | $0 | Free tier (up to 50k users) |
| Database (Railway/Supabase) | $0 | Included |
| **Total Infrastructure** | **$8-11** | |
| | | |
| OpenAI/Anthropic API | $3-30 | Usage-based |
| Gmail/Calendar API | $0 | Free |
| **Total with AI** | **$11-41** | Depends on usage |

### Scaling Costs

- **1k messages/month**: ~$11/month
- **10k messages/month**: ~$25/month
- **100k messages/month**: ~$150/month

Linear scaling = predictable costs ✅

---

## Troubleshooting

### Issue: "Supabase JWT secret not configured"

**Solution**: Make sure `SUPABASE_JWT_SECRET` is set in Railway environment variables. Redeploy after adding.

### Issue: "Session not found"

**Cause**: Redis not connected or session expired (5-min TTL).

**Solution**:
1. Check Railway Redis addon is running
2. Check logs for Redis connection errors
3. Sessions expire after 5 minutes - this is normal

### Issue: "Invalid or expired token"

**Cause**: JWT token is invalid or expired.

**Solution**:
1. Supabase tokens expire after 1 hour by default
2. Refresh the token using Supabase client:
   ```javascript
   const { data, error } = await supabase.auth.refreshSession()
   ```

### Issue: "MasterAgent initialization failed"

**Cause**: SessionManager not properly initialized.

**Solution**:
1. Check that Redis is running
2. Check logs for DI container errors
3. Verify `sessionManager` is registered in `core-services.ts`

---

## Migration Checklist

Use this checklist to track your setup progress:

- [ ] Create Supabase project
- [ ] Get Supabase credentials (URL, JWT Secret, Anon Key)
- [ ] Configure Google OAuth in Supabase
- [ ] Add Railway Redis addon
- [ ] Update Railway environment variables
- [ ] Deploy backend changes
- [ ] Test chat endpoint with cURL
- [ ] Test multi-turn conversation
- [ ] (Optional) Integrate with frontend
- [ ] Verify costs are within budget

---

## Next Steps

Once setup is complete:

1. **Remove old auth**: You can remove the old JWT-based auth endpoints once all clients are using Supabase
2. **Add more providers**: Supabase supports Apple, GitHub, etc. - easy to add
3. **Custom user metadata**: Store user preferences in Supabase `user_metadata`
4. **Row-level security**: Use Supabase RLS to secure data per user

---

## Support

- **Supabase Docs**: https://supabase.com/docs
- **Railway Docs**: https://docs.railway.app
- **Architecture**: See `/docs/FIRST_PRINCIPLES_DESIGN.md`

---

**You're all set!** 🎉

Your backend now uses:
- ✅ Supabase for authentication (OAuth, JWT, user management)
- ✅ Railway for deployment (no cold starts, auto-scaling)
- ✅ Redis for session management (fast, reliable)
- ✅ Simple chat API (natural language in/out)

Total migration: **~3-4 hours** from start to finish.
