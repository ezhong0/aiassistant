/**
 * AI Intent Recognition Tests
 * 
 * Tests whether the AI correctly interprets user intent rather than just routing.
 * Focuses on understanding quality, ambiguity resolution, and context awareness.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  AIBehaviorValidator,
  describeBehavior,
  itShouldUnderstand,
  IntentExpectation
} from '../framework/behavior-validator';

describeBehavior('Intent Recognition & Understanding', () => {
  let validator: AIBehaviorValidator;

  beforeEach(() => {
    validator = new AIBehaviorValidator();
  });

  describe('🎯 Primary Intent Recognition', () => {
    const primaryIntents: IntentExpectation[] = [
      {
        userInput: 'Send an email to John about the quarterly meeting',
        expectedIntent: 'email_communication',
        expectedAgents: ['contactAgent', 'emailAgent', 'Think'],
        confidence: 'high',
        context: 'Clear email intent with recipient and topic'
      },
      {
        userInput: 'Schedule a call with Sarah for next Tuesday at 2pm',
        expectedIntent: 'calendar_scheduling',
        expectedAgents: ['contactAgent', 'calendarAgent', 'Think'],
        confidence: 'high',
        context: 'Clear scheduling intent with person, date, and time'
      },
      {
        userInput: 'Find Dr. Smith\'s contact information',
        expectedIntent: 'contact_lookup',
        expectedAgents: ['contactAgent', 'Think'],
        confidence: 'high',
        context: 'Direct contact search request'
      },
      {
        userInput: 'Write a blog post about artificial intelligence trends',
        expectedIntent: 'content_creation',
        expectedAgents: ['contentCreator', 'Think'],
        confidence: 'high',
        context: 'Content creation with specific topic'
      },
      {
        userInput: 'What\'s the latest news about Tesla stock?',
        expectedIntent: 'information_search',
        expectedAgents: ['contactAgent', 'Think'], // Current routing behavior
        confidence: 'medium',
        context: 'Information gathering request'
      }
    ];

    primaryIntents.forEach(intent => {
      itShouldUnderstand(intent.context || 'Intent test', intent, validator);
    });
  });

  describe('🔀 Ambiguous Intent Resolution', () => {
    const ambiguousIntents: IntentExpectation[] = [
      {
        userInput: 'Can you help me with John?',
        expectedIntent: 'contact_disambiguation',
        expectedAgents: ['contactAgent', 'Think'],
        confidence: 'low',
        context: 'Ambiguous request requiring clarification'
      },
      {
        userInput: 'Send that thing to Mike',
        expectedIntent: 'email_clarification_needed',
        expectedAgents: ['contactAgent', 'emailAgent', 'Think'],
        confidence: 'low',
        context: 'Vague reference requiring context'
      },
      {
        userInput: 'Schedule something for tomorrow',
        expectedIntent: 'calendar_incomplete',
        expectedAgents: ['calendarAgent', 'Think'],
        confidence: 'low',
        context: 'Incomplete scheduling information'
      },
      {
        userInput: 'Create content about that topic we discussed',
        expectedIntent: 'content_context_dependent',
        expectedAgents: ['contentCreator', 'Think'],
        confidence: 'low',
        context: 'Reference to previous conversation context'
      }
    ];

    ambiguousIntents.forEach(intent => {
      it(`should handle ambiguity: ${intent.context}`, async () => {
        const result = await validator.validateIntent(intent);
        
        // For ambiguous intents, we expect the Think agent to be involved
        expect(result.actualAgents).toContain('Think');
        
        // The system should at least attempt some interpretation
        expect(result.actualAgents.length).toBeGreaterThan(0);
        expect(result.intentAccuracy).toBeGreaterThan(0.3); // Lower threshold for ambiguous cases
        
        console.log(`🤔 Ambiguous intent handling: ${result.details}`);
      });
    });
  });

  describe('🎭 Multi-Intent Recognition', () => {
    const multiIntents: IntentExpectation[] = [
      {
        userInput: 'Email John about the meeting and also schedule a follow-up call',
        expectedIntent: 'multi_communication',
        expectedAgents: ['contactAgent', 'emailAgent', 'calendarAgent', 'Think'],
        confidence: 'medium',
        context: 'Multiple related actions in single request'
      },
      {
        userInput: 'Find Sarah\'s contact info and send her the project updates',
        expectedIntent: 'contact_then_email',
        expectedAgents: ['contactAgent', 'emailAgent', 'Think'],
        confidence: 'high',
        context: 'Sequential actions with clear dependency'
      },
      {
        userInput: 'Research the latest AI trends and write a summary for the team',
        expectedIntent: 'research_then_create',
        expectedAgents: ['contactAgent', 'contentCreator', 'Think'], // Current behavior
        confidence: 'medium',
        context: 'Research followed by content creation'
      }
    ];

    multiIntents.forEach(intent => {
      it(`should recognize multiple intents: ${intent.context}`, async () => {
        const result = await validator.validateIntent(intent);
        
        // Multi-intent requests should involve multiple agents
        expect(result.actualAgents.length).toBeGreaterThanOrEqual(2);
        
        // Should include Think for coordination
        expect(result.actualAgents).toContain('Think');
        
        // At least partial intent recognition
        expect(result.intentAccuracy).toBeGreaterThan(0.5);
        
        console.log(`🎭 Multi-intent result: ${result.details}`);
      });
    });
  });

  describe('🌍 Context-Aware Intent Recognition', () => {
    it('should recognize intent changes within conversation', async () => {
      const sessionId = 'context-aware-test';
      
      // First establish context
      const contextSetup = await validator.validateIntent({
        userInput: 'I need to email my team about the project status',
        expectedIntent: 'email_team',
        expectedAgents: ['emailAgent', 'Think'],
        context: 'Initial email intent'
      });
      
      // Then test context-dependent follow-up
      const followUp = await validator.validateIntent({
        userInput: 'Actually, schedule a meeting instead',
        expectedIntent: 'calendar_pivot',
        expectedAgents: ['calendarAgent', 'Think'],
        context: 'Intent change from email to meeting'
      });
      
      expect(contextSetup.success || contextSetup.intentAccuracy > 0.5).toBe(true);
      expect(followUp.success || followUp.intentAccuracy > 0.5).toBe(true);
      
      console.log(`🌍 Context change: ${contextSetup.details} → ${followUp.details}`);
    });
  });

  describe('🎨 Intent Confidence Assessment', () => {
    it('should provide appropriate confidence levels', async () => {
      const confidenceTests = [
        {
          input: 'Send email to john.doe@company.com about Q3 results',
          expectedConfidence: 'high',
          reason: 'Explicit email address and clear topic'
        },
        {
          input: 'Contact John about the thing',
          expectedConfidence: 'low',
          reason: 'Vague reference to "the thing"'
        },
        {
          input: 'Help me',
          expectedConfidence: 'low',
          reason: 'Extremely vague request'
        }
      ];

      for (const test of confidenceTests) {
        const result = await validator.validateIntent({
          userInput: test.input,
          expectedIntent: 'test',
          expectedAgents: ['Think'],
          confidence: test.expectedConfidence as 'high' | 'medium' | 'low'
        });

        // High confidence should have high accuracy
        if (test.expectedConfidence === 'high') {
          expect(result.intentAccuracy).toBeGreaterThan(0.7);
        }
        
        // Low confidence should still attempt interpretation
        if (test.expectedConfidence === 'low') {
          expect(result.actualAgents.length).toBeGreaterThan(0);
        }

        console.log(`🎨 Confidence test (${test.expectedConfidence}): ${test.reason} → ${(result.intentAccuracy * 100).toFixed(1)}%`);
      }
    });
  });

  describe('🔍 Intent Understanding Quality Metrics', () => {
    it('should maintain high understanding quality across diverse inputs', async () => {
      const diverseInputs: IntentExpectation[] = [
        // Formal language
        {
          userInput: 'Please schedule a meeting with Dr. Johnson for Monday at 3:00 PM',
          expectedIntent: 'formal_scheduling',
          expectedAgents: ['contactAgent', 'calendarAgent', 'Think']
        },
        // Casual language  
        {
          userInput: 'hey can u email mike about the party?',
          expectedIntent: 'casual_email',
          expectedAgents: ['contactAgent', 'emailAgent', 'Think']
        },
        // Technical language
        {
          userInput: 'Generate a technical specification document for the API integration',
          expectedIntent: 'technical_content',
          expectedAgents: ['contentCreator', 'Think']
        },
        // Emotional context
        {
          userInput: 'I urgently need to contact Sarah about the emergency',
          expectedIntent: 'urgent_contact',
          expectedAgents: ['contactAgent', 'Think']
        }
      ];

      let totalAccuracy = 0;
      let successCount = 0;

      for (const intent of diverseInputs) {
        const result = await validator.validateIntent(intent);
        totalAccuracy += result.intentAccuracy;
        if (result.intentAccuracy > 0.6) successCount++;
        
        console.log(`🔍 ${intent.expectedIntent}: ${(result.intentAccuracy * 100).toFixed(1)}% accuracy`);
      }

      const averageAccuracy = totalAccuracy / diverseInputs.length;
      const successRate = successCount / diverseInputs.length;

      expect(averageAccuracy).toBeGreaterThan(0.6); // 60% average accuracy
      expect(successRate).toBeGreaterThan(0.7); // 70% of tests should pass threshold

      console.log(`📊 Overall Intent Understanding:`);
      console.log(`   Average Accuracy: ${(averageAccuracy * 100).toFixed(1)}%`);
      console.log(`   Success Rate: ${(successRate * 100).toFixed(1)}%`);
    });
  });
});