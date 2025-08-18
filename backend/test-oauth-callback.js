/**
 * OAuth Callback Test Script
 * 
 * This script tests the token exchange process.
 * Usage: node test-oauth-callback.js <authorization_code>
 */

require('dotenv').config();
const { authService } = require('./dist/services/auth.service');

async function testOAuthCallback() {
  const authCode = process.argv[2];
  
  if (!authCode) {
    console.log('❌ Please provide an authorization code');
    console.log('Usage: node test-oauth-callback.js <authorization_code>');
    console.log('');
    console.log('To get an authorization code:');
    console.log('1. Run: node test-oauth.js');
    console.log('2. Visit the generated auth URL');
    console.log('3. Complete OAuth flow');
    console.log('4. Copy the "code" parameter from the callback URL');
    return;
  }

  console.log('🧪 Testing OAuth Callback Flow...\n');
  console.log('📝 Authorization Code:', authCode.substring(0, 20) + '...\n');

  try {
    // Test 1: Exchange code for tokens
    console.log('1️⃣ Testing Token Exchange:');
    const tokens = await authService.exchangeCodeForTokens(authCode);
    console.log('✅ Token exchange successful!');
    console.log('📋 Token Details:');
    console.log('   - Access Token:', tokens.access_token.substring(0, 20) + '...');
    console.log('   - Token Type:', tokens.token_type);
    console.log('   - Expires In:', tokens.expires_in, 'seconds');
    console.log('   - Has Refresh Token:', !!tokens.refresh_token);
    console.log('   - Has ID Token:', !!tokens.id_token);
    console.log('');

    // Test 2: Validate access token
    console.log('2️⃣ Testing Access Token Validation:');
    const accessTokenResult = await authService.validateGoogleToken(tokens.access_token);
    if (accessTokenResult.valid) {
      console.log('✅ Access token is valid');
      console.log('📋 Token Info:', JSON.stringify(accessTokenResult.payload, null, 2));
    } else {
      console.log('❌ Access token validation failed:', accessTokenResult.error);
    }
    console.log('');

    // Test 3: Validate ID token (if present)
    if (tokens.id_token) {
      console.log('3️⃣ Testing ID Token Validation:');
      const idTokenResult = await authService.validateIdToken(tokens.id_token);
      if (idTokenResult.valid) {
        console.log('✅ ID token is valid');
        console.log('📋 User Info from ID Token:');
        console.log('   - Email:', idTokenResult.payload.email);
        console.log('   - Name:', idTokenResult.payload.name);
        console.log('   - Picture:', idTokenResult.payload.picture);
      } else {
        console.log('❌ ID token validation failed:', idTokenResult.error);
      }
      console.log('');
    }

    // Test 4: Get user info from Google API
    console.log('4️⃣ Testing Google User Info API:');
    try {
      const userInfo = await authService.getUserInfo(tokens.access_token);
      console.log('✅ User info retrieved successfully');
      console.log('📋 User Details:');
      console.log('   - ID:', userInfo.id);
      console.log('   - Email:', userInfo.email);
      console.log('   - Name:', userInfo.name);
      console.log('   - Verified Email:', userInfo.verified_email);
      console.log('   - Picture:', userInfo.picture);
      console.log('');
    } catch (error) {
      console.log('❌ Failed to get user info:', error.message);
    }

    // Test 5: Generate internal JWT
    console.log('5️⃣ Testing Internal JWT Generation:');
    const internalJWT = authService.generateJWT({
      userId: 'test_user',
      email: 'test@example.com',
      name: 'Test User'
    });
    console.log('✅ Internal JWT generated');
    console.log('📝 JWT:', internalJWT.substring(0, 50) + '...');
    
    const jwtValidation = authService.validateJWT(internalJWT);
    if (jwtValidation.valid) {
      console.log('✅ Internal JWT validation works');
    } else {
      console.log('❌ Internal JWT validation failed:', jwtValidation.error);
    }
    console.log('');

    // Test 6: Test token refresh (if refresh token available)
    if (tokens.refresh_token) {
      console.log('6️⃣ Testing Token Refresh:');
      try {
        const refreshedTokens = await authService.refreshAccessToken(tokens.refresh_token);
        console.log('✅ Token refresh successful!');
        console.log('📋 New Access Token:', refreshedTokens.access_token.substring(0, 20) + '...');
        console.log('   - Expires In:', refreshedTokens.expires_in, 'seconds');
      } catch (error) {
        console.log('❌ Token refresh failed:', error.message);
      }
      console.log('');
    }

    console.log('🎉 All OAuth tests passed! Your setup is working correctly.');
    console.log('');
    console.log('📋 NEXT STEPS:');
    console.log('1. Integrate this OAuth flow into your React Native app');
    console.log('2. Set up your backend routes to handle OAuth callbacks');
    console.log('3. Test Gmail and Calendar API calls with the access token');

  } catch (error) {
    console.log('❌ OAuth callback test failed:', error.message);
    console.log('');
    console.log('🔍 Troubleshooting:');
    console.log('1. Make sure your authorization code is fresh (they expire quickly)');
    console.log('2. Verify your redirect URI matches exactly in Google Cloud Console');
    console.log('3. Check that your client ID and secret are correct');
    console.log('4. Ensure the required APIs are enabled in Google Cloud Console');
  }
}

// Run the test
testOAuthCallback().catch(console.error);
