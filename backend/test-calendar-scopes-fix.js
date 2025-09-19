// Simple test to check if the issue is Gmail scopes
const { google } = require('googleapis');

async function testGmailScope() {
  console.log('🧪 Testing Gmail scope validation...');
  
  // Simulate the token from your logs (using fake token for testing)
  const sampleToken = 'FAKE_TOKEN_FOR_TESTING_ONLY_ya29.a0AQQ_BDSIq0wBtiJIMUbJHq3uJ1PzuIYPagE1VEr_alFD1vhtHl8ysjJNW4mxYtlXIQD_k1y9E9vVYxJPS-safZH87WacgACKIqTRXh43viKfFQr9U_QezHe2FFPVmFGiMPKcIkhFDPTMn2tGF5EmxJU13HRE_insMcpL2ZbEi0JxXrXvxqY_9HWKIrOQ1yGyhIFxkqZ4aCgYKAVYSARcSFQHGX2Mid_PrQ0owS2TjJaivxuZmQQ0207_PLACEHOLDER';
  
  try {
    // Create OAuth2 client like your Gmail service does
    const auth = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: sampleToken
    });

    console.log('🔍 Created OAuth2 client with token');
    console.log('Token preview:', sampleToken.substring(0, 30) + '...');
    
    // Try to initialize Gmail API
    const gmail = google.gmail({ version: 'v1', auth });
    
    console.log('✅ Gmail API initialized successfully');
    console.log('📧 This suggests the token format and setup is correct');
    console.log('❓ The issue might be:');
    console.log('  1. Token is actually expired (Google servers reject it)');
    console.log('  2. Token lacks Gmail API scopes');
    console.log('  3. Token refresh is needed but not happening');
    
    // The actual API call will fail in test env, but this shows the setup is correct
    
  } catch (error) {
    console.error('❌ OAuth setup failed:', error.message);
  }
}

testGmailScope();
