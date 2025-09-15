const { CalendarAgent } = require('./backend/src/agents/calendar.agent');
const { TokenManager } = require('./backend/src/services/token-manager');

// Mock services for testing
class MockCalendarService {
  isReady() { return true; }
  state = 'ready';
}

class MockTokenManager {
  async getValidTokensForCalendar(teamId, userId) {
    console.log(`MockTokenManager: Checking calendar tokens for ${teamId}:${userId}`);
    return null; // Simulate no valid calendar tokens
  }

  async needsCalendarReauth(teamId, userId) {
    console.log(`MockTokenManager: Checking reauth need for ${teamId}:${userId}`);
    return { needsReauth: true, reason: 'missing_calendar_scopes' };
  }
}

// Mock service manager
const mockServiceManager = {
  getService: (serviceName) => {
    if (serviceName === 'calendarService') {
      return new MockCalendarService();
    }
    if (serviceName === 'tokenManager') {
      return new MockTokenManager();
    }
    return null;
  }
};

// Override the getService function
global.getService = mockServiceManager.getService;

async function testCalendarAuth() {
  console.log('Testing calendar authentication detection...');

  const calendarAgent = new CalendarAgent();

  // Mock context for testing
  const mockContext = {
    sessionId: 'user:TEST_TEAM:TEST_USER',
    metadata: {
      teamId: 'TEST_TEAM',
      userId: 'TEST_USER'
    }
  };

  // Test parameters for calendar event creation
  const mockParameters = {
    action: 'create',
    summary: 'Test Meeting',
    start: new Date().toISOString(),
    end: new Date(Date.now() + 3600000).toISOString()
  };

  try {
    console.log('\n1. Testing calendar tool execution without valid tokens...');
    const result = await calendarAgent.executeCustomTool('create_calendar_event', mockParameters, mockContext);

    console.log('Result:', JSON.stringify(result, null, 2));

    if (result.needsReauth) {
      console.log('✅ SUCCESS: Calendar auth detection is working!');
      console.log(`   - needsReauth: ${result.needsReauth}`);
      console.log(`   - reauth_reason: ${result.reauth_reason}`);
      console.log(`   - message: ${result.message}`);
    } else {
      console.log('❌ FAILED: Calendar auth detection is not working properly');
    }

  } catch (error) {
    console.log('❌ ERROR during test:', error.message);
  }
}

testCalendarAuth().catch(console.error);