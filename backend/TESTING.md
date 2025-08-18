# Testing Your OAuth Setup

This guide helps you test your Google OAuth implementation step by step.

## Prerequisites

1. ✅ You have created both iOS and Web OAuth clients in Google Cloud Console
2. ✅ You have your Web client credentials (client ID and secret)
3. ✅ Your `.env` file is configured with the Web client credentials

## Step-by-Step Testing

### Step 1: Configure Environment Variables

Edit your `.env` file with your **Web OAuth client** credentials:

```env
# Use your WEB client credentials (not iOS client)
GOOGLE_CLIENT_ID=your_web_client_id_here
GOOGLE_CLIENT_SECRET=your_web_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# Your iOS client ID (for reference)
GOOGLE_IOS_CLIENT_ID=526055709746-golq3n9mgv1oh55sgim0s5qrqcped8j6.apps.googleusercontent.com
```

### Step 2: Run Basic OAuth Test

```bash
cd /Users/edwardzhong/Projects/assistantapp/backend
node test-oauth.js
```

This test will:
- ✅ Verify your environment variables are set
- ✅ Test auth service initialization
- ✅ Generate a Google OAuth authorization URL
- 🔗 Display the URL you need to visit

### Step 3: Complete OAuth Flow

1. **Copy the authorization URL** from the test output
2. **Open it in your browser**
3. **Sign in with Google** and grant permissions
4. **You'll be redirected** to `http://localhost:3000/auth/google/callback?code=...`
5. **Copy the `code` parameter** from the URL (the long string after `code=`)

### Step 4: Test Token Exchange

```bash
node test-oauth-callback.js YOUR_AUTHORIZATION_CODE_HERE
```

Replace `YOUR_AUTHORIZATION_CODE_HERE` with the code you copied from the callback URL.

This test will:
- ✅ Exchange authorization code for access/refresh tokens
- ✅ Validate the access token with Google
- ✅ Validate the ID token (if present)
- ✅ Retrieve user information from Google API
- ✅ Test internal JWT generation and validation
- ✅ Test token refresh (if refresh token available)

## Example Test Run

```bash
# Step 1: Basic test
$ node test-oauth.js
🧪 Testing OAuth Service Setup...

1️⃣ Testing Environment Variables:
✅ GOOGLE_CLIENT_ID: 123456789-abc123...
✅ GOOGLE_CLIENT_SECRET: GOCSPX-abc123...
✅ GOOGLE_REDIRECT_URI: http://localhost:3000/auth/google/callback
✅ All environment variables are set!

2️⃣ Testing Auth Service Initialization:
✅ Auth service initialized successfully
✅ JWT generation works
✅ JWT validation works

3️⃣ Testing Authorization URL Generation:
✅ Authorization URL generated successfully
🔗 Auth URL: https://accounts.google.com/o/oauth2/v2/auth?access_type=...

📋 NEXT STEPS:
1. Copy the URL above and open it in your browser
2. Complete the Google OAuth flow
3. Copy the authorization code from the callback URL
4. Run: node test-oauth-callback.js <authorization_code>

# Step 2: After completing OAuth flow
$ node test-oauth-callback.js 4/0AX4XfWh...
🧪 Testing OAuth Callback Flow...

1️⃣ Testing Token Exchange:
✅ Token exchange successful!
📋 Token Details:
   - Access Token: ya29.a0AfH6SMC...
   - Token Type: Bearer
   - Expires In: 3599 seconds
   - Has Refresh Token: true
   - Has ID Token: true

2️⃣ Testing Access Token Validation:
✅ Access token is valid

3️⃣ Testing ID Token Validation:
✅ ID token is valid
📋 User Info from ID Token:
   - Email: your.email@gmail.com
   - Name: Your Name
   - Picture: https://lh3.googleusercontent.com/...

4️⃣ Testing Google User Info API:
✅ User info retrieved successfully

5️⃣ Testing Internal JWT Generation:
✅ Internal JWT generated
✅ Internal JWT validation works

6️⃣ Testing Token Refresh:
✅ Token refresh successful!

🎉 All OAuth tests passed! Your setup is working correctly.
```

## Troubleshooting

### ❌ "redirect_uri_mismatch" Error
- **Problem:** Your redirect URI doesn't match what's configured in Google Cloud Console
- **Solution:** Ensure `http://localhost:3000/auth/google/callback` is exactly configured in your Web OAuth client

### ❌ "invalid_client" Error
- **Problem:** Wrong client ID or secret
- **Solution:** Double-check you're using the **Web client** credentials, not the iOS client ID

### ❌ "access_denied" Error
- **Problem:** You declined permissions or your app isn't verified
- **Solution:** Accept all permissions, or add yourself as a test user in OAuth consent screen

### ❌ "invalid_grant" Error
- **Problem:** Authorization code expired or already used
- **Solution:** Get a fresh authorization code (they expire in ~10 minutes)

### ❌ Environment Variable Issues
- **Problem:** Missing or incorrect environment variables
- **Solution:** Check your `.env` file and ensure you're using Web client credentials

## What This Tests

✅ **Environment Configuration** - Verifies all required variables are set  
✅ **Service Initialization** - Confirms OAuth client setup works  
✅ **Authorization Flow** - Tests auth URL generation  
✅ **Token Exchange** - Verifies code-to-token exchange  
✅ **Token Validation** - Tests Google token validation  
✅ **API Access** - Confirms you can call Google APIs  
✅ **JWT Handling** - Tests internal token management  
✅ **Token Refresh** - Verifies refresh token functionality  

## Next Steps After Testing

Once all tests pass:

1. **Integrate with your React Native app** using the iOS client ID
2. **Set up backend routes** to handle OAuth callbacks
3. **Test Gmail and Calendar API calls** with real data
4. **Implement proper error handling** in your app
5. **Set up token storage and management** in your mobile app

## Cleanup

After testing, you can remove the test files:

```bash
rm test-oauth.js test-oauth-callback.js TESTING.md
```

Your OAuth service is now ready for production integration!
