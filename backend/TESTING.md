# OAuth Testing Guide

This document provides comprehensive instructions for testing the OAuth authentication system and all related endpoints.

## Prerequisites

Before testing OAuth, ensure you have:
- Node.js installed (version 16 or higher)
- All dependencies installed (`npm install`)
- Google OAuth credentials configured in environment variables
- Server running (`npm run dev` or `npm start`)

## Environment Setup

### Required Environment Variables
Create a `.env` file in the backend directory with:
```
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
JWT_SECRET=your-secret-key
NODE_ENV=development
```

### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add `http://localhost:3000/auth/callback` to authorized redirect URIs

## Testing OAuth Endpoints

### 1. GET /auth/google - Initiate OAuth Flow

**Browser Test:**
```
http://localhost:3000/auth/google
```

**Expected Behavior:**
- Redirects to Google OAuth consent screen
- User sees permission request for email, profile, openid scopes
- After consent, redirects to callback URL

**cURL Test:**
```bash
curl -i "http://localhost:3000/auth/google"
```

**Expected Response:**
```
HTTP/1.1 302 Found
Location: https://accounts.google.com/o/oauth2/v2/auth?...
```

### 2. GET /auth/callback - Handle OAuth Callback

**Test Flow:**
1. Complete the `/auth/google` flow in browser
2. Google redirects back with authorization code
3. Server exchanges code for tokens

**Manual Test with Code:**
```bash
# Replace YOUR_AUTH_CODE with actual code from Google redirect
curl -i "http://localhost:3000/auth/callback?code=YOUR_AUTH_CODE"
```

**Expected Success Response:**
```json
{
  "success": true,
  "user": {
    "id": "google_user_id",
    "email": "user@example.com",
    "name": "User Name",
    "picture": "https://lh3.googleusercontent.com/..."
  },
  "tokens": {
    "access_token": "ya29.a0AfH6SMC...",
    "refresh_token": "1//04...",
    "id_token": "eyJhbGciOiJSUzI1NiIs...",
    "expires_in": 3599
  },
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Test Cases:**
```bash
# Test with invalid code
curl -i "http://localhost:3000/auth/callback?code=invalid_code"

# Test with error parameter
curl -i "http://localhost:3000/auth/callback?error=access_denied"

# Test without code
curl -i "http://localhost:3000/auth/callback"
```

### 3. POST /auth/refresh - Refresh Access Token

**Test with Valid Refresh Token:**
```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "YOUR_REFRESH_TOKEN"}'
```

**Expected Success Response:**
```json
{
  "success": true,
  "tokens": {
    "access_token": "ya29.a0AfH6SMC...",
    "refresh_token": "1//04...",
    "id_token": "eyJhbGciOiJSUzI1NiIs...",
    "expires_in": 3599
  },
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Test Cases:**
```bash
# Test without refresh token
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{}'

# Test with invalid refresh token
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "invalid_token"}'
```

### 4. GET /auth/validate - Validate JWT Token

**Test with Valid JWT:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/auth/validate
```

**Expected Success Response:**
```json
{
  "valid": true,
  "payload": {
    "userId": "google_user_id",
    "email": "user@example.com",
    "name": "User Name",
    "picture": "https://lh3.googleusercontent.com/...",
    "iat": 1640995200,
    "exp": 1641081600
  }
}
```

**Error Test Cases:**
```bash
# Test without authorization header
curl http://localhost:3000/auth/validate

# Test with invalid token
curl -H "Authorization: Bearer invalid_token" \
  http://localhost:3000/auth/validate

# Test with malformed header
curl -H "Authorization: invalid_format" \
  http://localhost:3000/auth/validate
```

### 5. POST /auth/logout - Logout User

**Test with Access Token:**
```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"access_token": "YOUR_ACCESS_TOKEN"}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Complete OAuth Flow Testing

### End-to-End Browser Test
1. Open `http://localhost:3000/auth/google`
2. Sign in with Google account
3. Grant permissions
4. Note the response with tokens and user info
5. Use the JWT token for subsequent API calls

### Postman Collection Test
Create a Postman collection with these requests:

1. **Start OAuth Flow**
   - GET `http://localhost:3000/auth/google`
   - Follow redirects manually

2. **Token Validation**
   - GET `http://localhost:3000/auth/validate`
   - Add `Authorization: Bearer {{jwt_token}}` header

3. **Token Refresh**
   - POST `http://localhost:3000/auth/refresh`
   - Body: `{"refresh_token": "{{refresh_token}}"}`

4. **Logout**
   - POST `http://localhost:3000/auth/logout`
   - Body: `{"access_token": "{{access_token}}"}`

## Testing with Scripts

### Automated Test Script
Create `test-oauth.js`:
```javascript
const axios = require('axios');

async function testOAuth() {
  try {
    // Test validation endpoint without token
    console.log('Testing validation without token...');
    const validateResponse = await axios.get('http://localhost:3000/auth/validate')
      .catch(err => err.response);
    console.log('Status:', validateResponse.status);
    console.log('Response:', validateResponse.data);

    // Test refresh without token
    console.log('\nTesting refresh without token...');
    const refreshResponse = await axios.post('http://localhost:3000/auth/refresh', {})
      .catch(err => err.response);
    console.log('Status:', refreshResponse.status);
    console.log('Response:', refreshResponse.data);

  } catch (error) {
    console.error('Test error:', error.message);
  }
}

testOAuth();
```

### Token Verification Script
Create `verify-tokens.js`:
```javascript
const { authService } = require('./dist/services/auth.service.js');

async function verifyTokens(accessToken, idToken) {
  console.log('Verifying access token...');
  const accessValidation = await authService.validateGoogleToken(accessToken);
  console.log('Access token valid:', accessValidation.valid);

  console.log('Verifying ID token...');
  const idValidation = await authService.validateIdToken(idToken);
  console.log('ID token valid:', idValidation.valid);
}

// Usage: node verify-tokens.js
const accessToken = process.argv[2];
const idToken = process.argv[3];

if (accessToken && idToken) {
  verifyTokens(accessToken, idToken);
} else {
  console.log('Usage: node verify-tokens.js <access_token> <id_token>');
}
```

## Server Testing

### Start the Server
```bash
# Development mode
npm run dev

# Production mode
npm run build && npm start
```

### Test Server Health
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2023-...",
  "uptime": 123.456,
  "environment": "development",
  "version": "1.0.0",
  "memory": {
    "used": 45.67,
    "total": 78.90
  }
}
```

## Common Testing Issues

### Port Conflicts
- Ensure server is running on correct port (3000)
- Check if port is already in use: `lsof -i :3000`

### Environment Variables
- Verify all required env vars are set
- Check Google OAuth credentials are correct
- Ensure redirect URI matches exactly

### CORS Issues
- Add CORS middleware if testing from browser
- Check allowed origins in production

### Token Expiration
- Access tokens expire in 1 hour
- Refresh tokens can be used to get new access tokens
- JWT tokens expire in 24 hours by default

## Debugging OAuth Flow

### Enable Debug Logging
Add to your `.env`:
```
DEBUG=true
LOG_LEVEL=debug
```

### Check Server Logs
Monitor server logs for OAuth-related errors:
```bash
tail -f logs/combined-$(date +%Y-%m-%d).log
```

### Google OAuth Debugging
- Check Google Cloud Console for API quotas
- Verify OAuth consent screen configuration
- Review authorized domains and redirect URIs

## Security Testing

### Test Invalid Scenarios
- Expired tokens
- Malformed tokens
- Wrong client credentials
- CSRF attacks with state parameter
- Token replay attacks

### Rate Limiting Tests
```bash
# Test multiple rapid requests
for i in {1..10}; do
  curl -X POST http://localhost:3000/auth/refresh \
    -H "Content-Type: application/json" \
    -d '{"refresh_token": "invalid"}' &
done
```

## Build and Type Checking

### Run Type Check
```bash
npm run typecheck
```

### Run Linting
```bash
npm run lint
```

### Build Project
```bash
npm run build
```

Expected: No TypeScript errors, successful build output in `dist/` directory.

## Production Testing

### Environment Variables for Production
```
NODE_ENV=production
GOOGLE_CLIENT_ID=prod_client_id
GOOGLE_CLIENT_SECRET=prod_client_secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/callback
JWT_SECRET=strong-production-secret
```

### SSL/HTTPS Testing
- Ensure redirect URIs use HTTPS in production
- Test certificate validity
- Verify secure cookie settings

## Troubleshooting Guide

| Error | Cause | Solution |
|-------|-------|----------|
| `redirect_uri_mismatch` | URI doesn't match Google Console | Update authorized redirect URIs |
| `invalid_client` | Wrong credentials | Check client ID/secret |
| `access_denied` | User denied permissions | Retry auth flow |
| `invalid_grant` | Code expired/used | Get fresh authorization code |
| `ECONNREFUSED` | Server not running | Start server with `npm run dev` |
| `Missing env vars` | Config issue | Check `.env` file |

Your OAuth implementation is now ready for comprehensive testing!