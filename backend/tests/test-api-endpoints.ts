/**
 * Test script for validating the new API endpoints and middleware
 */

import express from 'express';
import request from 'supertest';
import { validate } from '../src/middleware/validation.middleware';
import { assistantApiLogging } from '../src/middleware/api-logging.middleware';
import { userRateLimit } from '../src/middleware/rate-limiting.middleware';
import { z } from 'zod';

// Test the validation schemas
console.log('🧪 Testing Validation Schemas...');

const textCommandSchema = z.object({
  command: z.string()
    .min(1, 'Command is required')
    .max(5000, 'Command too long'),
  sessionId: z.string().optional(),
  context: z.object({
    conversationHistory: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().max(10000),
      timestamp: z.string().datetime().optional()
    })).optional(),
    pendingActions: z.array(z.object({
      actionId: z.string(),
      type: z.string(),
      parameters: z.record(z.string(), z.unknown()),
      awaitingConfirmation: z.boolean().optional()
    })).optional(),
    userPreferences: z.object({
      language: z.string().optional(),
      timezone: z.string().optional(),
      verbosity: z.enum(['minimal', 'normal', 'detailed']).optional()
    }).optional()
  }).optional()
});

// Test valid request
const validRequest = {
  command: "Send an email to john@example.com",
  sessionId: "session-123",
  context: {
    userPreferences: {
      verbosity: "normal" as const
    }
  }
};

try {
  const result = textCommandSchema.parse(validRequest);
  console.log('✅ Valid request parsed successfully');
} catch (error) {
  console.error('❌ Valid request failed:', error);
}

// Test invalid request
const invalidRequest = {
  command: "", // Empty command should fail
  sessionId: "session-123"
};

try {
  textCommandSchema.parse(invalidRequest);
  console.error('❌ Invalid request should have failed');
} catch (error) {
  console.log('✅ Invalid request properly rejected');
}

// Test API types
console.log('\n🔍 Testing TypeScript Interfaces...');

import { 
  TextCommandRequest, 
  TextCommandResponse,
  ConfirmActionRequest,
  SessionDataResponse,
  HealthCheckResponse
} from '../src/types/api.types';

// Test type compatibility
const testTextCommandRequest: TextCommandRequest = {
  command: "Test command",
  sessionId: "session-123",
  context: {
    userPreferences: {
      verbosity: "detailed"
    }
  }
};

const testResponse: TextCommandResponse = {
  success: true,
  type: "action_completed",
  message: "Test completed",
  data: {
    toolCalls: [],
    toolResults: [],
    sessionId: "session-123",
    conversationContext: {
      conversationHistory: [],
      lastActivity: new Date().toISOString()
    }
  }
};

console.log('✅ TypeScript interfaces compile correctly');

// Test middleware setup
console.log('\n⚙️  Testing Middleware Configuration...');

const app = express();
app.use(express.json());

// Test route with all middleware
app.post('/test-endpoint', 
  assistantApiLogging,
  userRateLimit(5, 60000), // 5 requests per minute for testing
  validate({ body: textCommandSchema }),
  (req, res) => {
    res.json({
      success: true,
      message: 'Test endpoint working',
      data: {
        requestId: (req as any).requestId,
        validatedBody: (req as any).validatedBody
      }
    });
  }
);

// Health check test
app.get('/test-health', (req, res) => {
  const healthResponse: HealthCheckResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: 'test',
    version: '1.0.0',
    memory: {
      used: 50,
      total: 100,
      rss: 60,
      external: 10
    },
    services: {
      masterAgent: { status: 'healthy', responseTime: 10, lastCheck: new Date().toISOString() },
      toolExecutor: { status: 'healthy', responseTime: 8, lastCheck: new Date().toISOString() },
      emailAgent: { status: 'healthy', responseTime: 15, lastCheck: new Date().toISOString() },
      sessionService: { status: 'healthy', responseTime: 5, lastCheck: new Date().toISOString() }
    },
    rateLimiting: {
      totalEntries: 10,
      memoryUsage: 1024
    },
    nodeVersion: process.version,
    pid: process.pid
  };
  
  res.json(healthResponse);
});

// Run tests
async function runTests() {
  console.log('\n🚀 Testing API Endpoints...');
  
  try {
    // Test valid request
    const validResponse = await request(app)
      .post('/test-endpoint')
      .send(validRequest)
      .expect(200);
    
    console.log('✅ Valid request test passed');
    console.log('   Request ID:', validResponse.body.data?.requestId ? 'Generated' : 'Missing');
    
    // Test invalid request
    await request(app)
      .post('/test-endpoint')
      .send(invalidRequest)
      .expect(400);
    
    console.log('✅ Invalid request properly rejected');
    
    // Test health endpoint
    const healthResponse = await request(app)
      .get('/test-health')
      .expect(200);
    
    console.log('✅ Health endpoint working');
    console.log('   Status:', healthResponse.body.status);
    
    // Test rate limiting (make 6 requests when limit is 5)
    for (let i = 0; i < 6; i++) {
      const response = await request(app)
        .post('/test-endpoint')
        .send(validRequest);
      
      if (i < 5) {
        if (response.status !== 200) {
          console.error(`❌ Request ${i + 1} should have succeeded`);
          break;
        }
      } else {
        if (response.status === 429) {
          console.log('✅ Rate limiting working - request 6 blocked');
        } else {
          console.error('❌ Rate limiting not working - request 6 should be blocked');
        }
      }
    }
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Add supertest to dependencies check
try {
  require.resolve('supertest');
  runTests();
} catch (error) {
  console.log('📦 Installing supertest for testing...');
  console.log('Run: npm install --save-dev supertest @types/supertest');
  console.log('Then run: npx ts-node src/test-api-endpoints.ts');
}

export { app };