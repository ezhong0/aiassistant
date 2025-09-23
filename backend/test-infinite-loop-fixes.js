const { BaseService } = require('./dist/services/base-service');
const { serviceManager, getService } = require('./dist/services/service-manager');
const { OpenAIService } = require('./dist/services/openai.service');
const { StringPlanningService } = require('./dist/services/string-planning.service');

async function testInfiniteLoopFixes() {
  console.log('🧪 Testing Infinite Loop Fixes...\n');

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

    // Test String Planning Service with repeated failures scenario
    console.log('\n📋 Testing Loop Prevention Logic...');
    const stringPlanning = new StringPlanningService();
    await stringPlanning.initialize();

    // Simulate a context with repeated calendar access failures (like in production)
    const testContext = {
      originalRequest: "what is on my calendar in two days",
      currentStep: 4,
      maxSteps: 10,
      completedSteps: [
        "Try to access your calendar events for January 26, 2025",
        "Try to access your calendar events for January 26, 2025, one more time",
        "Attempt to access your calendar events for January 26, 2025, one more time"
      ],
      stepResults: [
        "I'm sorry, but I wasn't able to access any calendar events for January 26, 2025. It seems that the attempt to retrieve the scheduled items ran into an issue",
        "It looks like I tried to access your calendar events for January 26, 2025, but unfortunately, I wasn't able to retrieve any scheduled items this time",
        "I attempted to access your calendar events for January 26, 2025, but unfortunately, it seems that I wasn't able to retrieve any scheduled items"
      ],
      userContext: { sessionId: 'test-session', userId: 'test-user' }
    };

    console.log('📝 Context with repeated failures:');
    console.log('- Previous steps:', testContext.completedSteps.length);
    console.log('- All steps about calendar access:', testContext.completedSteps.every(step =>
      step.toLowerCase().includes('access') && step.toLowerCase().includes('calendar')));
    console.log('- All results indicate failure:', testContext.stepResults.every(result =>
      result.toLowerCase().includes('wasn\'t able to') || result.toLowerCase().includes('unfortunately')));

    console.log('\n🔄 Calling planNextStep with failure context...');
    const plan = await stringPlanning.planNextStep(testContext);

    console.log('\n✅ Loop Prevention Test Result:');
    console.log('- Next Step:', plan.nextStep);
    console.log('- Is Complete:', plan.isComplete);
    console.log('- Reasoning:', plan.reasoning);

    if (plan.isComplete) {
      console.log('\n🎉 SUCCESS: Loop prevention is working - workflow marked as complete!');
    } else if (plan.nextStep && !plan.nextStep.toLowerCase().includes('try') && !plan.nextStep.toLowerCase().includes('attempt')) {
      console.log('\n✅ SUCCESS: Loop prevention is working - suggested different approach!');
    } else {
      console.log('\n⚠️  WARNING: Loop prevention may need improvement - still suggesting retry');
    }

    // Test analyzeStepResult with proper schema
    console.log('\n📊 Testing Step Result Analysis Schema Fix...');
    try {
      const analysis = await stringPlanning.analyzeStepResult(
        "Try to access calendar events",
        "Calendar service not available. Please check your calendar integration setup.",
        testContext
      );

      console.log('✅ Step analysis completed without schema errors:');
      console.log('- Summary:', analysis.summary);
      console.log('- Should Continue:', analysis.shouldContinue);
    } catch (error) {
      if (error.message.includes('schema must be a JSON Schema')) {
        console.log('❌ Schema error still present:', error.message);
      } else {
        console.log('✅ No schema errors, but got other error:', error.message);
      }
    }

    console.log('\n🧪 Infinite Loop Fixes Test Complete');

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

testInfiniteLoopFixes();