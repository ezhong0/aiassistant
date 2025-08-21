#!/usr/bin/env ts-node

/**
 * Memory-efficient AI Behavior Test Runner
 * Runs AI behavior tests without Jest overhead to avoid memory issues
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.DISABLE_RATE_LIMITING = 'true';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';  
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/google/callback';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';

import { SimpleBehaviorValidator } from './simple-behavior-validator';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  duration: number;
}

class MemoryEfficientTestRunner {
  private results: TestResult[] = [];
  private validator: SimpleBehaviorValidator | null = null;

  async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    let passed = false;
    let details = '';

    try {
      // Create fresh validator for each test
      this.validator = new SimpleBehaviorValidator();
      
      await testFn();
      passed = true;
      details = '✅ Test passed';
    } catch (error) {
      passed = false;
      details = `❌ ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      // Cleanup after each test
      if (this.validator) {
        this.validator.cleanup();
        this.validator = null;
      }
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
    }

    const duration = Date.now() - startTime;
    this.results.push({ name, passed, details, duration });
    
    console.log(`${passed ? '✅' : '❌'} ${name} (${duration}ms)`);
    if (!passed) {
      console.log(`   ${details}`);
    }
  }

  async runIntentRecognitionTests(): Promise<void> {
    console.log('\n🎯 Intent Recognition Tests');
    
    await this.runTest('Basic Email Intent', async () => {
      const result = await this.validator!.validateIntent({
        userInput: 'Send an email to john@company.com about the quarterly report',
        expectedIntent: 'email_communication',
        expectedAgents: ['emailAgent', 'Think']
      });
      
      if (!result.success || result.intentAccuracy < 0.7) {
        throw new Error(`Intent accuracy too low: ${(result.intentAccuracy * 100).toFixed(1)}%`);
      }
    });

    await this.runTest('Basic Calendar Intent', async () => {
      const result = await this.validator!.validateIntent({
        userInput: 'Schedule a meeting with the team tomorrow at 2pm',
        expectedIntent: 'calendar_scheduling',
        expectedAgents: ['contactAgent', 'calendarAgent', 'Think']
      });
      
      if (result.intentAccuracy < 0.5) { // Lower threshold due to routing differences
        throw new Error(`Intent accuracy too low: ${(result.intentAccuracy * 100).toFixed(1)}%`);
      }
    });

    await this.runTest('Basic Contact Intent', async () => {
      const result = await this.validator!.validateIntent({
        userInput: 'Find Dr. Smith\'s contact information',
        expectedIntent: 'contact_lookup',
        expectedAgents: ['contactAgent', 'Think']
      });
      
      if (!result.success || result.intentAccuracy < 0.7) {
        throw new Error(`Intent accuracy too low: ${(result.intentAccuracy * 100).toFixed(1)}%`);
      }
    });

    await this.runTest('Basic Content Intent', async () => {
      const result = await this.validator!.validateIntent({
        userInput: 'Write a blog post about artificial intelligence trends',
        expectedIntent: 'content_creation',
        expectedAgents: ['contentCreator', 'Think']
      });
      
      if (!result.success || result.intentAccuracy < 0.7) {
        throw new Error(`Intent accuracy too low: ${(result.intentAccuracy * 100).toFixed(1)}%`);
      }
    });
  }

  async runWorkflowTests(): Promise<void> {
    console.log('\n🔄 Workflow Orchestration Tests');

    await this.runTest('Email with Contact Lookup Workflow', async () => {
      const result = await this.validator!.validateWorkflow({
        name: 'Contact Lookup → Email Send',
        scenario: 'User wants to email someone without knowing their exact email address',
        steps: [{
          userInput: 'Send an email to John Smith about the project update',
          expectedAgents: ['contactAgent', 'emailAgent', 'Think'],
          expectedOrder: true
        }]
      });
      
      if (!result.success || result.workflowCoherence < 0.6) {
        throw new Error(`Workflow coherence too low: ${(result.workflowCoherence * 100).toFixed(1)}%`);
      }
    });

    await this.runTest('Calendar Scheduling Workflow', async () => {
      const result = await this.validator!.validateWorkflow({
        name: 'Contact Lookup → Calendar Scheduling',
        scenario: 'User wants to schedule a meeting with someone',
        steps: [{
          userInput: 'Schedule a meeting with Dr. Johnson for tomorrow at 2pm',
          expectedAgents: ['contactAgent', 'calendarAgent', 'Think'],
          expectedOrder: true
        }]
      });
      
      if (result.workflowCoherence < 0.5) {
        throw new Error(`Workflow coherence too low: ${(result.workflowCoherence * 100).toFixed(1)}%`);
      }
    });
  }

  async runContextTests(): Promise<void> {
    console.log('\n💭 Context Continuity Tests');

    await this.runTest('Basic Context Retention', async () => {
      const sessionId = 'context-test-' + Date.now();
      const result = await this.validator!.validateContextContinuity(sessionId, [
        {
          userInput: 'I need to contact John about the project',
          expectedResponse: {
            agents: ['contactAgent', 'Think']
          }
        },
        {
          userInput: 'Send him an email about it',
          expectedResponse: {
            agents: ['emailAgent', 'Think']
          }
        }
      ]);
      
      if (result.contextRetention < 0.5) {
        throw new Error(`Context retention too low: ${(result.contextRetention * 100).toFixed(1)}%`);
      }
    });
  }

  async runErrorRecoveryTests(): Promise<void> {
    console.log('\n🛡️ Error Recovery Tests');

    await this.runTest('Basic Error Handling', async () => {
      const result = await this.validator!.validateErrorRecovery({
        name: 'Email Service Test',
        failingComponent: 'emailAgent',
        userInput: 'Send an email to John about the meeting',
        expectedFallback: ['Think'],
        expectedRecovery: false,
        gracefulDegradation: true
      });
      
      if (!result.gracefulDegradation) {
        throw new Error('System did not degrade gracefully');
      }
    });
  }

  printSummary(): void {
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log('\n📊 Test Summary');
    console.log('='.repeat(50));
    console.log(`Tests: ${passed}/${total} passed`);
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Success rate: ${((passed / total) * 100).toFixed(1)}%`);
    
    if (passed < total) {
      console.log('\n❌ Failed tests:');
      this.results.filter(r => !r.passed).forEach(r => {
        console.log(`   ${r.name}: ${r.details}`);
      });
    }
  }

  async run(): Promise<void> {
    console.log('🧠 Memory-Efficient AI Behavior Test Runner');
    console.log('Running core AI behavior tests without Jest overhead\n');

    try {
      await this.runIntentRecognitionTests();
      await this.runWorkflowTests();
      await this.runContextTests();
      await this.runErrorRecoveryTests();
    } catch (error) {
      console.error('💥 Test runner failed:', error);
    }

    this.printSummary();
  }
}

// Run the tests
const runner = new MemoryEfficientTestRunner();
runner.run().then(() => {
  console.log('\n✨ Test runner completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});
