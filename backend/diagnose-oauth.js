/**
 * OAuth Diagnosis Script
 * This helps identify what's wrong with your OAuth setup
 */

require('dotenv').config();

console.log('🔍 OAuth Setup Diagnosis\n');

// Check environment variables
console.log('📋 Current Environment Variables:');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID || '❌ NOT SET');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET || '❌ NOT SET');
console.log('GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI || '❌ NOT SET');
console.log('');

// Check if values are still placeholders
const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

console.log('🔍 Checking for placeholder values:');

if (!clientId || clientId === 'your_web_client_id_here') {
  console.log('❌ GOOGLE_CLIENT_ID is not set or still has placeholder value');
  console.log('   You need to replace it with your actual Web OAuth client ID');
} else if (clientId.includes('526055709746')) {
  console.log('⚠️  WARNING: You might be using your iOS client ID instead of Web client ID');
  console.log('   iOS client ID: 526055709746-...');
  console.log('   You need a separate WEB OAuth client for your backend');
} else {
  console.log('✅ GOOGLE_CLIENT_ID looks correct');
}

if (!clientSecret || clientSecret === 'your_web_client_secret_here') {
  console.log('❌ GOOGLE_CLIENT_SECRET is not set or still has placeholder value');
  console.log('   You need to replace it with your actual Web OAuth client secret');
} else {
  console.log('✅ GOOGLE_CLIENT_SECRET is set');
}

console.log('');
console.log('🛠️  SOLUTION:');
console.log('1. Go to Google Cloud Console → APIs & Services → Credentials');
console.log('2. Create a NEW "Web application" OAuth client (separate from iOS)');
console.log('3. Add redirect URI: http://localhost:3000/auth/google/callback');
console.log('4. Download the JSON file');
console.log('5. Update your .env file with the Web client credentials');
console.log('');
console.log('📝 Your .env file should look like:');
console.log('GOOGLE_CLIENT_ID=123456789-abc123.apps.googleusercontent.com');
console.log('GOOGLE_CLIENT_SECRET=GOCSPX-AbCdEfGhIjKlMn');
console.log('GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback');
console.log('');
console.log('❗ IMPORTANT: Use WEB client credentials, not iOS client credentials!');
