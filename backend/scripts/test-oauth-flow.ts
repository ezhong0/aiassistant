#!/usr/bin/env npx ts-node

/**
 * Test script to simulate OAuth flow through Slack bot
 * This will test the error handling and authentication button response
 */

import { SlackFormatterService } from '../src/services/slack-formatter.service';

async function testOAuthFlow() {
  console.log('🧪 Testing OAuth flow through Slack bot...\n');
  
  const slackFormatter = new SlackFormatterService();
  
  // Simulate an authentication error that would trigger OAuth button
  const mockAuthError = new Error('Access token is required for email operations');
  mockAuthError.name = 'AuthenticationError';
  
  // Create mock agent result with authentication error
  const mockAgentResult = {
    response: 'Failed to send email due to authentication error.',
    error: mockAuthError,
    toolsUsed: ['emailAgent'],
    metadata: {
      email: {
        recipient: 'test@example.com',
        subject: 'Test Email',
        content: 'This is a test email that should fail with auth error.'
      }
    }
  };
  
  console.log('📧 Mock email operation that requires authentication:');
  console.log(`Recipient: ${mockAgentResult.metadata.email.recipient}`);
  console.log(`Subject: ${mockAgentResult.metadata.email.subject}`);
  console.log(`Error: ${mockAuthError.message}\n`);
  
  // Format error response - this should include the OAuth button
  const errorResponse = slackFormatter.formatErrorMessageResponse(mockAuthError.message);
  
  console.log('🔧 Formatted Slack response with OAuth button:');
  console.log(JSON.stringify(errorResponse, null, 2));
  
  // Check if OAuth button is present
  const hasOAuthButton = errorResponse.blocks?.some((block: any) => 
    block.type === 'actions' && 
    block.elements?.some((element: any) => 
      element.text?.text?.includes('🔑 Connect Gmail Account')
    )
  );
  
  console.log('\n✅ Test Results:');
  console.log(`OAuth Button Present: ${hasOAuthButton ? '✅ YES' : '❌ NO'}`);
  console.log(`Response Type: ${errorResponse.response_type || 'in_channel'}`);
  console.log(`Blocks Count: ${errorResponse.blocks?.length || 0}`);
  
  if (hasOAuthButton) {
    const actionBlock = errorResponse.blocks?.find((block: any) => block.type === 'actions');
    const oauthButton = actionBlock?.elements?.find((element: any) => 
      element.text?.text?.includes('🔑 Connect Gmail Account')
    );
    
    console.log(`OAuth URL: ${oauthButton?.url || 'NOT FOUND'}`);
    console.log('\n🎉 OAuth flow integration is working correctly!');
  } else {
    console.log('\n❌ OAuth button was not added to the error response.');
  }
  
  console.log('\n📋 Next steps for testing:');
  console.log('1. Deploy the updated code');
  console.log('2. Try to send an email through the Slack bot');
  console.log('3. Click the "🔑 Connect Gmail Account" button');
  console.log('4. Complete the OAuth flow');
  console.log('5. Try sending the email again');
}

testOAuthFlow().catch(console.error);