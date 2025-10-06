/**
 * Simple JWT Token Generator for Testing
 *
 * Usage: node generate-token.js
 */

const crypto = require('crypto');

// JWT Secret - must match SUPABASE_JWT_SECRET in your .env
const JWT_SECRET = 'development_supabase_jwt_secret_for_testing_only_min_32_chars';

// Helper function to base64url encode
function base64url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Generate a test JWT token
function generateTestToken(userId, email) {
  // Header
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  // Payload (Supabase format)
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId || `test-user-${Date.now()}`,
    email: email || `test-${Date.now()}@example.com`,
    role: 'authenticated',
    aud: 'authenticated',
    iss: 'supabase',
    exp: now + (24 * 60 * 60), // 24 hours from now
    iat: now,
    user_metadata: {
      name: 'Test User'
    },
    app_metadata: {
      provider: 'email'
    }
  };

  // Create token parts
  const headerEncoded = base64url(JSON.stringify(header));
  const payloadEncoded = base64url(JSON.stringify(payload));
  const signatureInput = `${headerEncoded}.${payloadEncoded}`;

  // Create signature
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(signatureInput)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  // Return complete token
  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

// Generate token
const token = generateTestToken();
console.log('\n🎫 Generated Test JWT Token:\n');
console.log(token);
console.log('\n📋 Usage:\n');
console.log(`1. Open: http://localhost:8080?token=${token}`);
console.log(`2. Or paste the token manually in the web chat interface`);
console.log('\n⏱️  Token valid for: 24 hours\n');
