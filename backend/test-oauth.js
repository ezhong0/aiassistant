/**
 * OAuth Service Test Script
 * 
 * This script helps you test your OAuth setup step by step.
 * Run this to verify your Google OAuth configuration is working.
 */

require('dotenv').config();
const { authService } = require('./dist/services/auth.service');

async function testOAuthSetup() {
  console.log('🧪 Testing OAuth Service Setup...\n');

  // Test 1: Environment Variables
  console.log('1️⃣ Testing Environment Variables:');
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId) {
    console.log('❌ GOOGLE_CLIENT_ID is missing');
    return;
  }
  if (!clientSecret) {
    console.log('❌ GOOGLE_CLIENT_SECRET is missing');
    return;
  }
  if (!redirectUri) {
    console.log('❌ GOOGLE_REDIRECT_URI is missing');
    return;
  }

  console.log('✅ GOOGLE_CLIENT_ID:', clientId.substring(0, 20) + '...');
  console.log('✅ GOOGLE_CLIENT_SECRET:', clientSecret.substring(0, 10) + '...');
  console.log('✅ GOOGLE_REDIRECT_URI:', redirectUri);
  console.log('✅ All environment variables are set!\n');

  // Test 2: Auth Service Initialization
  console.log('2️⃣ Testing Auth Service Initialization:');
  try {
    // Test if the service initializes without throwing errors
    const testJWT = authService.generateJWT({ test: 'data' }, '1h');
    console.log('✅ Auth service initialized successfully');
    console.log('✅ JWT generation works');
    
    // Test JWT validation
    const jwtResult = authService.validateJWT(testJWT);
    if (jwtResult.valid) {
      console.log('✅ JWT validation works');
    } else {
      console.log('❌ JWT validation failed:', jwtResult.error);
    }
  } catch (error) {
    console.log('❌ Auth service initialization failed:', error.message);
    return;
  }
  console.log('');

  // Test 3: Generate Authorization URL
  console.log('3️⃣ Testing Authorization URL Generation:');
  try {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];
    
    const authUrl = authService.generateAuthUrl(scopes);
    console.log('✅ Authorization URL generated successfully');
    console.log('🔗 Auth URL:', authUrl);
    console.log('');
    console.log('📋 NEXT STEPS:');
    console.log('1. Copy the URL above and open it in your browser');
    console.log('2. Complete the Google OAuth flow');
    console.log('3. Copy the authorization code from the callback URL');
    console.log('4. Run: node test-oauth-callback.js <authorization_code>');
    console.log('');
  } catch (error) {
    console.log('❌ Authorization URL generation failed:', error.message);
    return;
  }

  console.log('🎉 Basic OAuth setup is working! Follow the next steps above to complete the test.');
}

// Run the test
testOAuthSetup().catch(console.error);
