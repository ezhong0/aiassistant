# Frontend Setup Guide

## Supabase Authentication Integration

The frontend now uses **Supabase OAuth** for authentication instead of custom token management. This provides:

- ✅ Automatic session management via AsyncStorage
- ✅ Built-in token refresh
- ✅ Secure JWT token handling
- ✅ Support for OAuth providers (Google, etc.)

## Setup Steps

### 1. Configure Supabase

Update the Supabase configuration in `src/config/supabase.ts`:

```typescript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

Get these values from your Supabase project:
1. Go to https://app.supabase.com
2. Select your project
3. Go to Settings → API
4. Copy the "Project URL" and "anon public" key

### 2. Install Dependencies

```bash
npm install
```

Dependencies installed:
- `@supabase/supabase-js` - Supabase client library
- `react-native-url-polyfill` - Required for Supabase in React Native
- `@react-native-async-storage/async-storage` - Session storage

### 3. Start Metro Bundler

```bash
npm start
```

### 4. Run on iOS

```bash
npm run ios
```

**Note**: You'll need to configure your Apple Developer Team in Xcode:
1. Open `ios/ChatbotApp.xcworkspace` in Xcode
2. Select the ChatbotApp project
3. Go to "Signing & Capabilities"
4. Check "Automatically manage signing"
5. Select your Team

## Authentication Flow

### Sign Up
1. User enters email and password
2. App calls `apiService.signUp(email, password)`
3. Supabase creates user account
4. User must confirm email (if configured in Supabase)
5. User can then sign in

### Sign In
1. User enters email and password
2. App calls `apiService.signInWithPassword(email, password)`
3. Supabase validates credentials and returns session
4. Session is automatically stored in AsyncStorage
5. Access token is used for all backend API calls

### Session Management
- Sessions are automatically restored on app restart
- Tokens are automatically refreshed when expired
- On 401 error, app automatically attempts token refresh

## API Integration

The `apiService` now:

1. **Gets token from Supabase session** (not custom storage):
   ```typescript
   const { data: { session } } = await supabase.auth.getSession();
   const token = session?.access_token;
   ```

2. **Automatically refreshes expired tokens**:
   - On 401 response, calls `supabase.auth.refreshSession()`
   - Retries request with new token

3. **Backend Integration**:
   - Sends token as `Authorization: Bearer <token>`
   - Backend validates using `SUPABASE_JWT_SECRET`
   - Backend extracts user ID from JWT payload

## Backend Setup Required

The backend must have these environment variables:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_ANON_KEY=your-anon-key
```

Get JWT Secret from: Supabase → Settings → API → JWT Settings

## Testing

### Manual Test Flow

1. **Start the app** - should show sign-in screen
2. **Create account** - tap "Create Account", enter email/password
3. **Sign in** - use credentials to sign in
4. **Send message** - should connect to backend with Supabase JWT
5. **Restart app** - session should be restored automatically
6. **Sign out** - clears session and returns to auth screen

### Test with Existing Supabase User

If you have a Supabase user already:
1. Sign in with existing credentials
2. App will get valid JWT token
3. Backend will validate using SUPABASE_JWT_SECRET

## Troubleshooting

### "Supabase URL not configured"
- Update `src/config/supabase.ts` with your Supabase project URL and anon key

### "Not authenticated - please sign in"
- Session expired or doesn't exist
- Sign in again to create new session

### "Invalid or expired token" (from backend)
- Backend's `SUPABASE_JWT_SECRET` doesn't match your Supabase project
- Verify the JWT secret in both places

### Backend not responding
- Make sure backend is running: `cd ../backend && npm start`
- Update `API_BASE_URL` in `src/services/api.service.ts` if needed

## Architecture

```
┌─────────────────┐
│  React Native   │
│     App.tsx     │
└────────┬────────┘
         │
         ├─── Supabase Client ──────┐
         │    (Session Management)   │
         │                           │
         ▼                           ▼
┌─────────────────┐        ┌──────────────┐
│   API Service   │        │ AsyncStorage │
│ (Chat Backend)  │        │  (Sessions)  │
└────────┬────────┘        └──────────────┘
         │
         │ Bearer Token (JWT)
         ▼
┌─────────────────────────────────┐
│      Backend API                │
│  - Validates JWT with secret    │
│  - Extracts user ID             │
│  - Processes chat requests      │
└─────────────────────────────────┘
```

## Next Steps

1. **Set up Supabase** - Create project and get credentials
2. **Configure frontend** - Update `src/config/supabase.ts`
3. **Configure backend** - Add Supabase environment variables
4. **Test flow** - Sign up → Sign in → Send message
5. **Add OAuth** - Enable Google OAuth in Supabase for easier sign-in

## Benefits Over Custom Token Manager

✅ **No manual token storage** - Supabase handles AsyncStorage
✅ **Automatic token refresh** - No expired token errors
✅ **Built-in OAuth support** - Easy Google/Apple sign-in
✅ **Secure by default** - Industry-standard JWT handling
✅ **Session persistence** - Automatic restore on app restart
✅ **Better UX** - Seamless authentication experience
