const { BaseService } = require('./dist/services/base-service');
const { serviceManager, getService } = require('./dist/services/service-manager');
const { OpenAIService } = require('./dist/services/openai.service');
const { StringPlanningService } = require('./dist/services/string-planning.service');

async function testAIFixes() {
  console.log('🧪 Testing AI Service Fixes...\n');

  try {
    // Initialize and register OpenAI service with the singleton service manager
    const openaiService = new OpenAIService({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o-mini'
    });
    await openaiService.initialize();

    // Register with the global singleton service manager
    serviceManager.registerService('openaiService', openaiService);

    console.log('✅ OpenAI Service initialized and registered');

    // Test String Planning Service
    console.log('\n📋 Testing String Planning Service...');
    const stringPlanning = new StringPlanningService();
    await stringPlanning.initialize();

    const testContext = {
      originalRequest: "Schedule a meeting with John for next Tuesday",
      currentStep: 1,
      maxSteps: 5,
      completedSteps: [],
      stepResults: [],
      userContext: { sessionId: 'test-session', userId: 'test-user' }
    };

    console.log('Calling planNextStep with test context...');

    // Enable debug logging for the test
    process.env.LOG_LEVEL = 'debug';

    // Mock the logger to capture debug output
    const winston = require('winston');
    const testLogger = winston.createLogger({
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          console.log(`[${level}] ${message}`, meta);
          return `${timestamp} [${level}] ${message}`;
        })
      ),
      transports: [new winston.transports.Console()]
    });

    // Override the logger temporarily
    const originalLogger = require('./dist/utils/logger').default;
    require('./dist/utils/logger').default.debug = testLogger.debug.bind(testLogger);

    const plan = await stringPlanning.planNextStep(testContext);

    console.log('✅ String Planning Response:', {
      nextStep: plan.nextStep,
      isComplete: plan.isComplete,
      reasoning: plan.reasoning
    });

    // Test that we get a proper response structure
    if (plan.nextStep && typeof plan.nextStep === 'string' && plan.nextStep.length > 0) {
      console.log('✅ String planning now returns structured responses instead of empty objects');
    } else {
      console.log('❌ String planning still returning invalid responses');
    }

    console.log('\n🧪 AI Fixes Test Complete');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Set up minimal environment with actual environment variables
require('dotenv').config({ path: '../.env' });

if (!process.env.OPENAI_API_KEY) {
  console.log('❌ OPENAI_API_KEY not found in environment');
  console.log('Please ensure .env file has OPENAI_API_KEY configured');
  process.exit(1);
}

process.env.NODE_ENV = 'test';

testAIFixes();