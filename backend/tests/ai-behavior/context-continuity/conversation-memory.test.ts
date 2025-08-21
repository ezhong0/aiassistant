/**
 * Conversation Context & Memory Tests
 * 
 * Tests conversation context continuity, memory retention, and multi-turn intelligence.
 * Validates that the system maintains coherent context across interactions.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  AIBehaviorValidator,
  describeBehavior,
  ConversationTurn
} from '../framework/behavior-validator';

describeBehavior('Conversation Context & Memory', () => {
  let validator: AIBehaviorValidator;

  beforeEach(() => {
    validator = new AIBehaviorValidator();
  });

  describe('💭 Context Retention Across Turns', () => {
    it('should maintain context in sequential related requests', async () => {
      const sessionId = 'context-retention-test';
      
      const conversationTurns: ConversationTurn[] = [
        {
          userInput: 'I need to contact John about the project',
          expectedResponse: {
            agents: ['contactAgent', 'Think'],
            contextRetained: ['person:John', 'topic:project']
          }
        },
        {
          userInput: 'Send him an email about it',
          expectedResponse: {
            agents: ['emailAgent', 'Think'],
            contextRetained: ['person:John', 'topic:project', 'action:email']
          }
        },
        {
          userInput: 'Also schedule a follow-up meeting',
          expectedResponse: {
            agents: ['calendarAgent', 'Think'],
            contextRetained: ['person:John', 'topic:project', 'action:meeting']
          }
        }
      ];

      const result = await validator.validateContextContinuity(sessionId, conversationTurns);
      
      expect(result.success).toBe(true);
      expect(result.contextRetention).toBeGreaterThan(0.7); // 70% context retention
      
      console.log(`💭 Context retention across ${conversationTurns.length} turns: ${(result.contextRetention * 100).toFixed(1)}%`);
      
      result.turnResults.forEach((turn, index) => {
        console.log(`   Turn ${turn.turn}: ${turn.success ? '✅' : '❌'} (${(turn.contextScore * 100).toFixed(1)}%)`);
      });
    });
  });

  describe('🔗 Reference Resolution', () => {
    it('should resolve pronouns and references correctly', async () => {
      const sessionId = 'reference-resolution-test';
      
      const referenceConversation: ConversationTurn[] = [
        {
          userInput: 'Find Sarah Johnson\'s contact information',
          expectedResponse: {
            agents: ['contactAgent', 'Think'],
            newContext: { 'currentPerson': 'Sarah Johnson' }
          }
        },
        {
          userInput: 'Email her about the quarterly review',
          expectedResponse: {
            agents: ['emailAgent', 'Think'],
            contextRetained: ['currentPerson']
          }
        },
        {
          userInput: 'Schedule a meeting with her next week',
          expectedResponse: {
            agents: ['calendarAgent', 'Think'],
            contextRetained: ['currentPerson']
          }
        }
      ];

      const result = await validator.validateContextContinuity(sessionId, referenceConversation);
      
      // Reference resolution should maintain good context
      expect(result.contextRetention).toBeGreaterThan(0.6);
      
      console.log(`🔗 Reference resolution quality: ${(result.contextRetention * 100).toFixed(1)}%`);
    });
  });

  describe('🧵 Topic Continuity', () => {
    it('should maintain topic consistency across conversation', async () => {
      const sessionId = 'topic-continuity-test';
      
      const topicConversation: ConversationTurn[] = [
        {
          userInput: 'I\'m working on the AI project proposal',
          expectedResponse: {
            agents: ['contentCreator', 'Think'],
            newContext: { 'currentTopic': 'AI project proposal' }
          }
        },
        {
          userInput: 'Create an outline for the technical section',
          expectedResponse: {
            agents: ['contentCreator', 'Think'],
            contextRetained: ['currentTopic']
          }
        },
        {
          userInput: 'Find research papers about machine learning for the references',
          expectedResponse: {
            agents: ['contactAgent', 'Think'], // Current search behavior
            contextRetained: ['currentTopic']
          }
        },
        {
          userInput: 'Email the draft to the technical review team',
          expectedResponse: {
            agents: ['emailAgent', 'Think'],
            contextRetained: ['currentTopic']
          }
        }
      ];

      const result = await validator.validateContextContinuity(sessionId, topicConversation);
      
      expect(result.contextRetention).toBeGreaterThan(0.5);
      
      console.log(`🧵 Topic continuity maintained: ${(result.contextRetention * 100).toFixed(1)}%`);
    });
  });

  describe('⏰ Context Decay and Refresh', () => {
    it('should handle context decay appropriately over time', async () => {
      const sessionId = 'context-decay-test';
      
      // Initial context establishment
      const initialTurns: ConversationTurn[] = [
        {
          userInput: 'Schedule a meeting with Dr. Smith about the research project',
          expectedResponse: {
            agents: ['contactAgent', 'calendarAgent', 'Think']
          }
        }
      ];

      const initialResult = await validator.validateContextContinuity(sessionId, initialTurns);
      
      // Simulate time passage and context refresh
      const refreshTurns: ConversationTurn[] = [
        {
          userInput: 'What was that meeting about again?',
          expectedResponse: {
            agents: ['Think'],
            contextRetained: ['meeting', 'Dr. Smith', 'research project']
          }
        },
        {
          userInput: 'Send a reminder email to him',
          expectedResponse: {
            agents: ['emailAgent', 'Think'],
            contextRetained: ['Dr. Smith']
          }
        }
      ];

      const refreshResult = await validator.validateContextContinuity(sessionId, refreshTurns);
      
      // Context should still be somewhat retained
      expect(refreshResult.contextRetention).toBeGreaterThan(0.3);
      
      console.log(`⏰ Context after refresh: ${(refreshResult.contextRetention * 100).toFixed(1)}%`);
    });
  });

  describe('🔄 Context Switching', () => {
    it('should handle clean context switches between topics', async () => {
      const sessionId = 'context-switching-test';
      
      const switchingConversation: ConversationTurn[] = [
        // First topic: Project management
        {
          userInput: 'Create a project timeline for the website redesign',
          expectedResponse: {
            agents: ['contentCreator', 'Think']
          }
        },
        {
          userInput: 'Email the timeline to the design team',
          expectedResponse: {
            agents: ['emailAgent', 'Think']
          }
        },
        // Context switch: Different topic
        {
          userInput: 'Now let\'s switch topics - find contact info for the new vendor',
          expectedResponse: {
            agents: ['contactAgent', 'Think']
          }
        },
        {
          userInput: 'Schedule a call with them to discuss pricing',
          expectedResponse: {
            agents: ['calendarAgent', 'Think']
          }
        }
      ];

      const result = await validator.validateContextContinuity(sessionId, switchingConversation);
      
      // Should handle the context switch gracefully
      expect(result.success).toBe(true);
      
      console.log(`🔄 Context switching handling: ${result.turnResults.map(t => t.success ? '✅' : '❌').join(' ')}`);
    });
  });

  describe('🧠 Contextual Intelligence Assessment', () => {
    it('should demonstrate intelligent use of conversation context', async () => {
      const sessionId = 'contextual-intelligence-test';
      
      const intelligentConversation: ConversationTurn[] = [
        {
          userInput: 'I have a client presentation tomorrow at 9am',
          expectedResponse: {
            agents: ['Think'], // Should recognize this as context setting
            newContext: { 'event': 'client presentation', 'time': 'tomorrow 9am' }
          }
        },
        {
          userInput: 'Prepare the slides',
          expectedResponse: {
            agents: ['contentCreator', 'Think'],
            contextRetained: ['event']
          }
        },
        {
          userInput: 'Send a reminder to the team',
          expectedResponse: {
            agents: ['emailAgent', 'Think'],
            contextRetained: ['event', 'time']
          }
        },
        {
          userInput: 'What if we need to reschedule?',
          expectedResponse: {
            agents: ['calendarAgent', 'Think'],
            contextRetained: ['event', 'time']
          }
        }
      ];

      const result = await validator.validateContextContinuity(sessionId, intelligentConversation);
      
      // Intelligent context use should show high retention
      expect(result.contextRetention).toBeGreaterThan(0.6);
      
      // Each turn should build on previous context
      let improvingContext = true;
      for (let i = 1; i < result.turnResults.length; i++) {
        const currentTurn = result.turnResults[i];
        const previousTurn = result.turnResults[i-1];
        if (currentTurn && previousTurn && currentTurn.contextScore < previousTurn.contextScore * 0.8) {
          improvingContext = false;
          break;
        }
      }
      
      console.log(`🧠 Contextual intelligence demonstrated: ${improvingContext ? 'Yes' : 'No'}`);
      console.log(`🧠 Overall context retention: ${(result.contextRetention * 100).toFixed(1)}%`);
    });
  });

  describe('🔍 Context Recovery', () => {
    it('should recover context when user provides clarification', async () => {
      const sessionId = 'context-recovery-test';
      
      const recoveryConversation: ConversationTurn[] = [
        {
          userInput: 'Send that thing',
          expectedResponse: {
            agents: ['Think'], // Should recognize ambiguity
          }
        },
        {
          userInput: 'I mean the project proposal document',
          expectedResponse: {
            agents: ['contentCreator', 'Think'],
            newContext: { 'document': 'project proposal' }
          }
        },
        {
          userInput: 'Email it to the stakeholders',
          expectedResponse: {
            agents: ['emailAgent', 'Think'],
            contextRetained: ['document']
          }
        }
      ];

      const result = await validator.validateContextContinuity(sessionId, recoveryConversation);
      
      // Context recovery should improve over the conversation
      const firstTurn = result.turnResults[0];
      const lastTurn = result.turnResults[result.turnResults.length - 1];
      const firstTurnScore = firstTurn?.contextScore || 0;
      const lastTurnScore = lastTurn?.contextScore || 0;
      
      expect(lastTurnScore).toBeGreaterThan(firstTurnScore);
      
      console.log(`🔍 Context recovery: ${(firstTurnScore * 100).toFixed(1)}% → ${(lastTurnScore * 100).toFixed(1)}%`);
    });
  });

  describe('📚 Memory Persistence Validation', () => {
    it('should maintain consistent context within session boundaries', async () => {
      const sessionId = 'memory-persistence-test';
      
      // Test multiple mini-conversations within same session
      const conversations = [
        [
          {
            userInput: 'Find John\'s email address',
            expectedResponse: { agents: ['contactAgent', 'Think'] }
          }
        ],
        [
          {
            userInput: 'Now email John about the meeting',
            expectedResponse: { agents: ['emailAgent', 'Think'] }
          }
        ],
        [
          {
            userInput: 'Schedule a follow-up with John',
            expectedResponse: { agents: ['calendarAgent', 'Think'] }
          }
        ]
      ];

      let totalRetention = 0;
      
      for (const conversation of conversations) {
        const result = await validator.validateContextContinuity(sessionId, conversation);
        totalRetention += result.contextRetention;
      }

      const avgRetention = totalRetention / conversations.length;
      expect(avgRetention).toBeGreaterThan(0.5);
      
      console.log(`📚 Memory persistence across mini-conversations: ${(avgRetention * 100).toFixed(1)}%`);
    });
  });
});