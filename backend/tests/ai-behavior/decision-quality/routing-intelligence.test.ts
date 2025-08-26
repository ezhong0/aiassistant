/**
 * Agent Decision Quality Tests
 * 
 * Tests routing decision quality, consistency, and appropriateness.
 * Validates that agent selection demonstrates intelligence rather than just pattern matching.
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from '@jest/globals';
import {
  AIBehaviorValidator,
  describeBehavior,
  DecisionQualityMetric
} from '../framework/behavior-validator';

describeBehavior('Agent Decision Quality & Routing Intelligence', () => {
  let validator: AIBehaviorValidator;

  beforeAll(async () => {
    await AIBehaviorValidator.initializeServices();
  });

  afterAll(async () => {
    await AIBehaviorValidator.cleanupServices();
  });

  beforeEach(() => {
    validator = new AIBehaviorValidator();
  });

  describe('🎯 Decision Appropriateness', () => {
    const appropriatenessMetrics: DecisionQualityMetric[] = [
      {
        scenario: 'Clear email intent',
        userInput: 'Send an email to john.doe@company.com about the quarterly results',
        expectedDecision: 'emailAgent',
        alternativeDecisions: [],
        qualityFactors: ['explicit_email_address', 'clear_communication_intent', 'specific_topic']
      },
      {
        scenario: 'Clear calendar intent',
        userInput: 'Schedule a meeting with the board for next Tuesday at 2 PM',
        expectedDecision: 'calendarAgent',
        alternativeDecisions: [],
        qualityFactors: ['temporal_reference', 'scheduling_verb', 'specific_time']
      },
      {
        scenario: 'Contact lookup intent',
        userInput: 'Find Dr. Johnson\'s phone number',
        expectedDecision: 'contactAgent',
        alternativeDecisions: [],
        qualityFactors: ['contact_information_request', 'person_identifier', 'specific_data_type']
      },
      {
        scenario: 'Content creation intent',
        userInput: 'Write a technical specification for the new API',
        expectedDecision: 'contentCreator',
        alternativeDecisions: [],
        qualityFactors: ['creation_verb', 'document_type', 'technical_context']
      },
      {
        scenario: 'Information search intent',
        userInput: 'What are the latest developments in quantum computing?',
        expectedDecision: 'contactAgent', // Current routing behavior
        alternativeDecisions: ['Tavily'],
        qualityFactors: ['information_seeking', 'current_events', 'research_topic']
      }
    ];

    appropriatenessMetrics.forEach(metric => {
      it(`should make appropriate decision for: ${metric.scenario}`, async () => {
        const results = await validator.validateDecisionQuality([metric]);
        const decision = results.decisions[0];
        
        expect(decision?.quality || 0).toBeGreaterThan(0.6); // 60% quality threshold
        
        console.log(`🎯 ${metric.scenario}:`);
        console.log(`   Expected: ${metric.expectedDecision}`);
        console.log(`   Actual: ${decision?.decision || 'none'}`);
        console.log(`   Quality: ${((decision?.quality || 0) * 100).toFixed(1)}%`);
        console.log(`   Rationale: ${decision?.rationale || 'No rationale'}`);
      });
    });
  });

  describe('⚖️ Decision Consistency', () => {
    it('should make consistent decisions for similar inputs', async () => {
      const consistencyMetrics: DecisionQualityMetric[] = [
        {
          scenario: 'Email variation 1',
          userInput: 'Send an email to Sarah about the project update',
          expectedDecision: 'emailAgent',
          alternativeDecisions: [],
          qualityFactors: ['email_communication', 'person_reference', 'topic_context']
        },
        {
          scenario: 'Email variation 2',
          userInput: 'Email Mike regarding the deadline change',
          expectedDecision: 'emailAgent',
          alternativeDecisions: [],
          qualityFactors: ['email_communication', 'person_reference', 'topic_context']
        },
        {
          scenario: 'Email variation 3',
          userInput: 'Message the team about tomorrow\'s meeting',
          expectedDecision: 'emailAgent',
          alternativeDecisions: [],
          qualityFactors: ['message_communication', 'group_reference', 'event_context']
        }
      ];

      const results = await validator.validateDecisionQuality(consistencyMetrics);
      
      // All similar scenarios should have similar decisions
      const decisions = results.decisions.map(d => d.decision);
      const uniqueDecisions = new Set(decisions);
      
      expect(results.consistency).toBeGreaterThan(0.7); // 70% consistency
      expect(uniqueDecisions.size).toBeLessThanOrEqual(2); // Should be mostly the same decision
      
      console.log(`⚖️ Decision consistency:`);
      console.log(`   Decisions: [${decisions.join(', ')}]`);
      console.log(`   Consistency score: ${(results.consistency * 100).toFixed(1)}%`);
    });
  });

  describe('🎨 Decision Nuance Recognition', () => {
    const nuanceMetrics: DecisionQualityMetric[] = [
      {
        scenario: 'Urgent vs normal communication',
        userInput: 'URGENT: Email the CEO immediately about the security breach',
        expectedDecision: 'emailAgent',
        alternativeDecisions: [],
        qualityFactors: ['urgency_indicator', 'high_priority_recipient', 'critical_topic']
      },
      {
        scenario: 'Formal vs informal scheduling',
        userInput: 'Set up a formal board meeting for the quarterly review',
        expectedDecision: 'calendarAgent',
        alternativeDecisions: [],
        qualityFactors: ['formal_context', 'important_meeting', 'structured_event']
      },
      {
        scenario: 'Personal vs professional contact',
        userInput: 'Find my dentist\'s office phone number',
        expectedDecision: 'contactAgent',
        alternativeDecisions: [],
        qualityFactors: ['personal_service', 'business_contact', 'specific_information']
      },
      {
        scenario: 'Creative vs technical content',
        userInput: 'Draft a creative marketing campaign for the new product launch',
        expectedDecision: 'contentCreator',
        alternativeDecisions: [],
        qualityFactors: ['creative_writing', 'marketing_content', 'campaign_development']
      }
    ];

    nuanceMetrics.forEach(metric => {
      it(`should recognize nuance in: ${metric.scenario}`, async () => {
        const results = await validator.validateDecisionQuality([metric]);
        const decision = results.decisions[0];
        
        // Nuanced decisions should still be of good quality
        expect(decision?.quality || 0).toBeGreaterThan(0.5);
        
        console.log(`🎨 ${metric.scenario}:`);
        console.log(`   Decision: ${decision?.decision || 'none'}`);
        console.log(`   Quality: ${((decision?.quality || 0) * 100).toFixed(1)}%`);
        console.log(`   Factors: [${metric.qualityFactors.join(', ')}]`);
      });
    });
  });

  describe('🔀 Complex Decision Scenarios', () => {
    it('should handle multi-faceted decision scenarios', async () => {
      const complexMetrics: DecisionQualityMetric[] = [
        {
          scenario: 'Multi-step workflow initiation',
          userInput: 'Research the competition and create a comparison report for the executive team',
          expectedDecision: 'contactAgent', // Current behavior for search
          alternativeDecisions: ['Tavily', 'contentCreator'],
          qualityFactors: ['research_required', 'content_creation', 'executive_audience']
        },
        {
          scenario: 'Communication with context dependency',
          userInput: 'Email John about what we discussed in our last meeting',
          expectedDecision: 'emailAgent',
          alternativeDecisions: ['contactAgent'],
          qualityFactors: ['contextual_reference', 'person_communication', 'meeting_follow_up']
        },
        {
          scenario: 'Time-sensitive multi-action request',
          userInput: 'Find Sarah\'s contact info and schedule an emergency call within the hour',
          expectedDecision: 'contactAgent',
          alternativeDecisions: ['calendarAgent'],
          qualityFactors: ['contact_lookup', 'urgent_scheduling', 'multi_step_process']
        }
      ];

      const results = await validator.validateDecisionQuality(complexMetrics);
      
      // Complex scenarios should still demonstrate good decision quality
      expect(results.overallQuality).toBeGreaterThan(0.5);
      
      console.log(`🔀 Complex decision scenarios:`);
      console.log(`   Overall quality: ${(results.overallQuality * 100).toFixed(1)}%`);
      
      results.decisions.forEach((decision, index) => {
        console.log(`   Scenario ${index + 1}: ${decision.decision} (${(decision.quality * 100).toFixed(1)}%)`);
      });
    });
  });

  describe('🎪 Edge Case Decision Handling', () => {
    const edgeCaseMetrics: DecisionQualityMetric[] = [
      {
        scenario: 'Ambiguous pronoun reference',
        userInput: 'Send it to them',
        expectedDecision: 'Think',
        alternativeDecisions: ['emailAgent'],
        qualityFactors: ['ambiguous_reference', 'unclear_action', 'missing_context']
      },
      {
        scenario: 'Conflicting action signals',
        userInput: 'Email John but don\'t send it yet, just schedule it for later',
        expectedDecision: 'emailAgent',
        alternativeDecisions: ['calendarAgent', 'Think'],
        qualityFactors: ['delayed_action', 'scheduling_element', 'email_preparation']
      },
      {
        scenario: 'Impossible request',
        userInput: 'Delete all emails from last year but keep them archived',
        expectedDecision: 'Think',
        alternativeDecisions: ['emailAgent'],
        qualityFactors: ['contradictory_instructions', 'complex_operation', 'clarification_needed']
      },
      {
        scenario: 'Cross-domain expertise needed',
        userInput: 'Create a legal document for the software license agreement',
        expectedDecision: 'contentCreator',
        alternativeDecisions: ['Think'],
        qualityFactors: ['specialized_knowledge', 'legal_content', 'professional_document']
      }
    ];

    edgeCaseMetrics.forEach(metric => {
      it(`should handle edge case: ${metric.scenario}`, async () => {
        const results = await validator.validateDecisionQuality([metric]);
        const decision = results.decisions[0];
        
        // Edge cases should be handled gracefully, even if quality is lower
        expect(decision?.decision).toBeTruthy();
        expect(decision?.quality || 0).toBeGreaterThan(0.2); // Lower threshold for edge cases
        
        console.log(`🎪 ${metric.scenario}:`);
        console.log(`   Decision: ${decision?.decision || 'none'}`);
        console.log(`   Quality: ${((decision?.quality || 0) * 100).toFixed(1)}%`);
      });
    });
  });

  describe('📊 Decision Quality Analytics', () => {
    it('should demonstrate measurable decision quality improvements', async () => {
      // Test a range of scenarios to get quality analytics
      const analyticsMetrics: DecisionQualityMetric[] = [
        // High clarity scenarios
        {
          scenario: 'high_clarity_email',
          userInput: 'Send email to boss@company.com about project completion',
          expectedDecision: 'emailAgent',
          alternativeDecisions: [],
          qualityFactors: ['explicit_address', 'clear_intent']
        },
        {
          scenario: 'high_clarity_calendar',
          userInput: 'Schedule meeting tomorrow 2pm with marketing team',
          expectedDecision: 'calendarAgent',
          alternativeDecisions: [],
          qualityFactors: ['specific_time', 'clear_participants']
        },
        // Medium clarity scenarios
        {
          scenario: 'medium_clarity_contact',
          userInput: 'Find John from the sales team',
          expectedDecision: 'contactAgent',
          alternativeDecisions: [],
          qualityFactors: ['person_identifier', 'department_context']
        },
        // Lower clarity scenarios
        {
          scenario: 'low_clarity_mixed',
          userInput: 'Help me with the thing about the client',
          expectedDecision: 'Think',
          alternativeDecisions: ['contactAgent', 'emailAgent'],
          qualityFactors: ['vague_reference', 'unclear_action']
        }
      ];

      const results = await validator.validateDecisionQuality(analyticsMetrics);
      
      // Calculate quality distribution
      const qualityDistribution = {
        high: results.decisions.filter(d => d.quality > 0.8).length,
        medium: results.decisions.filter(d => d.quality > 0.5 && d.quality <= 0.8).length,
        low: results.decisions.filter(d => d.quality <= 0.5).length
      };

      expect(results.overallQuality).toBeGreaterThan(0.6);
      expect(qualityDistribution.high + qualityDistribution.medium).toBeGreaterThan(qualityDistribution.low);

      console.log(`📊 Decision Quality Analytics:`);
      console.log(`   Overall Quality: ${(results.overallQuality * 100).toFixed(1)}%`);
      console.log(`   Consistency: ${(results.consistency * 100).toFixed(1)}%`);
      console.log(`   Quality Distribution:`);
      console.log(`     High (>80%): ${qualityDistribution.high} decisions`);
      console.log(`     Medium (50-80%): ${qualityDistribution.medium} decisions`);
      console.log(`     Low (<50%): ${qualityDistribution.low} decisions`);
    });
  });

  describe('🧠 Intelligence vs Pattern Matching', () => {
    it('should demonstrate intelligence beyond simple pattern matching', async () => {
      const intelligenceMetrics: DecisionQualityMetric[] = [
        {
          scenario: 'Context-dependent decision',
          userInput: 'Follow up on our conversation',
          expectedDecision: 'Think',
          alternativeDecisions: ['emailAgent', 'calendarAgent'],
          qualityFactors: ['context_dependency', 'unclear_method', 'requires_clarification']
        },
        {
          scenario: 'Intent inference',
          userInput: 'The presentation is ready for the board',
          expectedDecision: 'Think',
          alternativeDecisions: ['emailAgent', 'contentCreator'],
          qualityFactors: ['implied_action', 'status_update', 'next_steps_unclear']
        },
        {
          scenario: 'Situational awareness',
          userInput: 'It\'s almost 5pm and I still need to reach the client',
          expectedDecision: 'contactAgent',
          alternativeDecisions: ['emailAgent', 'Think'],
          qualityFactors: ['time_awareness', 'urgency_implication', 'communication_need']
        }
      ];

      const results = await validator.validateDecisionQuality(intelligenceMetrics);
      
      // Intelligence should be demonstrated through appropriate handling of ambiguous cases
      const thoughtfulDecisions = results.decisions.filter(d => 
        d.decision === 'Think' || d.quality > 0.5
      ).length;
      
      expect(thoughtfulDecisions / results.decisions.length).toBeGreaterThan(0.6);
      
      console.log(`🧠 Intelligence Assessment:`);
      console.log(`   Thoughtful decisions: ${thoughtfulDecisions}/${results.decisions.length}`);
      console.log(`   Intelligence ratio: ${((thoughtfulDecisions / results.decisions.length) * 100).toFixed(1)}%`);
      
      results.decisions.forEach((decision, index) => {
        const metric = intelligenceMetrics[index];
        if (metric) {
          console.log(`   ${metric.scenario}: ${decision?.decision || 'none'} (${((decision?.quality || 0) * 100).toFixed(1)}%)`);
        }
      });
    });
  });
});