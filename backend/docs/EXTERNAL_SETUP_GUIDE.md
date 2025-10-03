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

## Step 3: Update Railway Environment Variables

### 3.1 Add Supabase Variables

In Railway project settings → **Variables**, add:

```bash
# Supabase Authentication
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_JWT_SECRET=your-jwt-secret-from-supabase
SUPABASE_ANON_KEY=your-anon-key-from-supabase
```

**Note**: No Redis needed - backend is stateless! ✅

### 3.2 Verify Existing Variables

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

### 3.3 Add Node Environment

If not already set:

```bash
NODE_ENV=production
```

---

## Step 4: Deploy Backend Changes

### 4.1 Commit and Push

The backend code changes are already done. To deploy:

```bash
# From backend directory
git add .
git commit -m "feat: add stateless Supabase auth and chat API"
git push origin main
```

Railway will automatically:
1. Detect the push
2. Build the new code
3. Deploy with new environment variables

### 4.2 Verify Deployment

Check Railway logs for:

```
✅ Server started successfully
✅ Application routes configured
✅ DI Container initialized
```

---

## Step 5: Test the Chat API (Stateless)

### 5.1 Get a Supabase Auth Token

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

### 5.2 Test First Message (No Context)

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
  "context": {
    "conversationHistory": [
      {"role": "user", "content": "Hello! Can you help me?", "timestamp": 1234567890},
      {"role": "assistant", "content": "Hello! I'm your AI assistant...", "timestamp": 1234567891}
    ],
    "masterState": {...},
    "subAgentStates": {...}
  },
  "metadata": {
    "processing_time": 1.234
  }
}
```

**Save the entire `context` object** - you'll send it with the next request.

### 5.3 Test Multi-Turn Conversation (With Context)

Send the context from the previous response:

```bash
curl -X POST 'https://your-backend.railway.app/api/chat/message' \
-H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
-H "Content-Type: application/json" \
-d '{
  "message": "What did I just ask you?",
  "context": {
    "conversationHistory": [
      {"role": "user", "content": "Hello! Can you help me?", "timestamp": 1234567890},
      {"role": "assistant", "content": "Hello! I'\''m your AI assistant...", "timestamp": 1234567891}
    ],
    "masterState": {...},
    "subAgentStates": {...}
  }
}'
```

The AI should remember your previous message and provide updated context in the response.

---

## Step 6: Frontend Integration (Optional)

### 6.1 Install Supabase Client

```bash
npm install @supabase/supabase-js
```

### 6.2 Initialize Supabase

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
```

### 6.3 Example: Sign In with Google

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

### 6.4 Example: Stateless Chat API Call

```javascript
// Store context in component state or localStorage
const [context, setContext] = useState(null)

const response = await fetch('https://your-backend.railway.app/api/chat/message', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: 'Find my emails from Sarah',
    context: context // Include previous context for multi-turn
  })
})

const data = await response.json()
console.log(data.message) // AI response
setContext(data.context) // Save context for next turn
```

**Key Difference**: Client manages `context` instead of `session_id`. Store in state or localStorage for persistence.

---

## Step 7: Cost Breakdown (Stateless)

### Current Monthly Costs

| Service | Cost | Notes |
|---------|------|-------|
| Railway Backend | $5-8 | Hobby plan |
| Railway Redis | $0 | Not needed! ✅ |
| Supabase Auth | $0 | Free tier (up to 50k users) |
| Database (Railway/Supabase) | $0 | Included |
| **Total Infrastructure** | **$5-8** | **Cheaper than session-based!** |
| | | |
| OpenAI/Anthropic API | $3-30 | Usage-based |
| Gmail/Calendar API | $0 | Free |
| **Total with AI** | **$8-38** | Depends on usage |

### Scaling Costs

- **1k messages/month**: ~$8/month
- **10k messages/month**: ~$20/month
- **100k messages/month**: ~$120/month

Linear scaling = predictable costs ✅

**Savings**: $3-5/month by going stateless!

---

## Troubleshooting

### Issue: "Supabase JWT secret not configured"

**Solution**: Make sure `SUPABASE_JWT_SECRET` is set in Railway environment variables. Redeploy after adding.

### Issue: "Invalid or expired token"

**Cause**: JWT token is invalid or expired.

**Solution**:
1. Supabase tokens expire after 1 hour by default
2. Refresh the token using Supabase client:
   ```javascript
   const { data, error } = await supabase.auth.refreshSession()
   ```

### Issue: "Context too large"

**Cause**: Conversation history has grown very large.

**Solution**:
1. The backend keeps only last 5 turns automatically
2. Client can reset context by not sending it (starts new conversation)
3. For long conversations, consider summarization

### Issue: "MasterAgent initialization failed"

**Cause**: DI container initialization error.

**Solution**:
1. Check logs for DI container errors
2. Verify all required environment variables are set
3. Check that database connection is working

---

## Migration Checklist

Use this checklist to track your setup progress:

- [ ] Create Supabase project
- [ ] Get Supabase credentials (URL, JWT Secret, Anon Key)
- [ ] Configure Google OAuth in Supabase
- [ ] Update Railway environment variables (NO Redis needed!)
- [ ] Deploy backend changes
- [ ] Test chat endpoint with cURL (first message)
- [ ] Test multi-turn conversation (with context)
- [ ] (Optional) Integrate with frontend
- [ ] Verify costs are within budget

---

## Next Steps

Once setup is complete:

1. **Remove old auth**: You can remove the old JWT-based auth endpoints once all clients are using Supabase
2. **Add more providers**: Supabase supports Apple, GitHub, etc. - easy to add
3. **Custom user metadata**: Store user preferences in Supabase `user_metadata`
4. **Client state management**: Consider using localStorage or IndexedDB for conversation persistence
5. **Context summarization**: For very long conversations, implement AI summarization to keep context small

---

## Support

- **Supabase Docs**: https://supabase.com/docs
- **Railway Docs**: https://docs.railway.app
- **Architecture**: See `/docs/FIRST_PRINCIPLES_DESIGN.md` (v3.0 - Stateless)

---

**You're all set!** 🎉

Your backend now uses:
- ✅ Supabase for authentication (OAuth, JWT, user management)
- ✅ Railway for deployment (no cold starts, auto-scaling)
- ✅ Stateless architecture (no Redis, infinite scaling!)
- ✅ Simple chat API (natural language in/out, client manages context)

**Benefits of stateless approach:**
- Simpler backend (no session management)
- Cheaper ($3-5/month savings - no Redis)
- Infinitely scalable (no shared state)
- Easier debugging (full context in each request)

Total migration: **~2-3 hours** from start to finish.
