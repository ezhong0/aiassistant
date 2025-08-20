import dotenv from 'dotenv';
import logger from './utils/logger';
import { contactAgent } from './agents/contact.agent';
import { ContactAgent } from './agents/contact.agent';

// Load environment variables
dotenv.config();

/**
 * Test the Contact Agent functionality
 */
async function testContactAgent() {
  logger.info('🧪 Starting Contact Agent tests...');

  // Mock access token for testing (replace with real token for actual testing)
  const mockAccessToken = process.env.TEST_ACCESS_TOKEN || 'mock_token';

  const testQueries = [
    'find john',
    'search for john smith',
    'get contact info for sarah',
    'lookup mike',
    'find contact for jane doe',
    'search mary@example.com',
    'find contacts named david'
  ];

  const results = [];

  for (const query of testQueries) {
    try {
      logger.info(`\n📞 Testing query: "${query}"`);
      
      const result = await contactAgent.processQuery(
        { query },
        mockAccessToken
      );

      logger.info('✅ Contact Agent Response:', {
        success: result.success,
        message: result.message,
        contactCount: result.data?.contacts?.length || 0,
        error: result.error
      });

      if (result.success && result.data?.contacts) {
        result.data.contacts.forEach((contact, index) => {
          logger.info(`  ${index + 1}. ${contact.name} (${contact.email}) - Confidence: ${contact.confidence?.toFixed(2)} - Source: ${contact.source}`);
        });
      }

      results.push({
        query,
        success: result.success,
        contactCount: result.data?.contacts?.length || 0,
        error: result.error
      });

    } catch (error) {
      logger.error(`❌ Error testing query "${query}":`, error);
      results.push({
        query,
        success: false,
        contactCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Test utility functions
  logger.info('\n🛠️  Testing utility functions...');
  
  const mockContacts = [
    {
      id: '1',
      name: 'John Smith',
      email: 'john@example.com',
      source: 'contacts' as const,
      confidence: 0.9
    },
    {
      id: '2',
      name: 'John Doe',
      email: 'johndoe@example.com',
      source: 'other_contacts' as const,
      confidence: 0.7
    }
  ];

  // Test formatContactsForAgent
  const formattedContacts = ContactAgent.formatContactsForAgent(mockContacts);
  logger.info('✅ Formatted contacts for other agents:', formattedContacts);

  // Test getBestMatch
  const bestMatch = ContactAgent.getBestMatch(mockContacts);
  logger.info('✅ Best match:', bestMatch?.name);

  // Test isAmbiguous
  const isAmbiguous = ContactAgent.isAmbiguous(mockContacts, 0.8);
  logger.info('✅ Is ambiguous result:', isAmbiguous);

  // Summary
  logger.info('\n📊 Test Summary:');
  logger.info(`Total queries tested: ${results.length}`);
  
  if (mockAccessToken === 'mock_token') {
    logger.warn('⚠️  Tests run with mock token - contact searches will fail');
    logger.info('To test with real data:');
    logger.info('1. Set TEST_ACCESS_TOKEN environment variable');
    logger.info('2. Ensure Google People API is enabled');
    logger.info('3. User must have authorized contacts.readonly scope');
  } else {
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    logger.info(`✅ Successful: ${successful}`);
    logger.info(`❌ Failed: ${failed}`);
    
    if (failed > 0) {
      logger.warn('Failed queries:');
      results.filter(r => !r.success).forEach(r => {
        logger.warn(`  - "${r.query}": ${r.error}`);
      });
    }
  }

  logger.info('\n🎯 Integration Notes:');
  logger.info('- Contact Agent is now integrated with tool executor');
  logger.info('- EmailAgent can receive resolved contacts from ContactAgent');
  logger.info('- Master agent will call contactAgent + emailAgent for "send email to john" queries');
  logger.info('- Fuzzy matching handles typos and partial names');
  logger.info('- Frequently contacted people are included in search results');

  logger.info('\n✨ Contact Agent testing completed!');
}

// Run the test if this file is executed directly
if (require.main === module) {
  testContactAgent().catch(error => {
    logger.error('Test failed:', error);
    process.exit(1);
  });
}

export { testContactAgent };