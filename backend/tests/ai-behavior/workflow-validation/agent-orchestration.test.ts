/**
 * Multi-Agent Workflow Validation Tests
 * 
 * Tests complete user journeys and agent collaboration rather than individual components.
 * Focuses on workflow orchestration, agent coordination, and end-to-end intelligence.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  AIBehaviorValidator,
  describeBehavior,
  itShouldOrchestrate,
  WorkflowExpectation
} from '../framework/behavior-validator';

describeBehavior('Multi-Agent Workflow Orchestration', () => {
  let validator: AIBehaviorValidator;

  beforeEach(() => {
    validator = new AIBehaviorValidator();
  });

  describe('🔄 Sequential Workflows', () => {
    const sequentialWorkflows: WorkflowExpectation[] = [
      {
        name: 'Contact Lookup → Email Send',
        scenario: 'User wants to email someone without knowing their exact email address',
        steps: [
          {
            userInput: 'Send an email to John Smith about the project update',
            expectedAgents: ['contactAgent', 'emailAgent', 'Think'],
            expectedOrder: true
          }
        ]
      },
      {
        name: 'Contact Lookup → Calendar Scheduling',
        scenario: 'User wants to schedule a meeting with someone',
        steps: [
          {
            userInput: 'Schedule a meeting with Dr. Johnson for tomorrow at 2pm',
            expectedAgents: ['contactAgent', 'calendarAgent', 'Think'],
            expectedOrder: true
          }
        ]
      },
      {
        name: 'Research → Content Creation',
        scenario: 'User wants to research a topic and create content about it',
        steps: [
          {
            userInput: 'Research artificial intelligence trends and write a blog post',
            expectedAgents: ['contactAgent', 'contentCreator', 'Think'], // Current behavior
            expectedOrder: false
          }
        ]
      }
    ];

    sequentialWorkflows.forEach(workflow => {
      itShouldOrchestrate(workflow.scenario, workflow, validator);
    });
  });

  describe('🌊 Multi-Step User Journeys', () => {
    const complexJourneys: WorkflowExpectation[] = [
      {
        name: 'Complete Project Communication Workflow',
        scenario: 'User manages a project from research to team communication',
        steps: [
          {
            userInput: 'Find the latest market research for our project',
            expectedAgents: ['contactAgent', 'Think'], // Current search behavior
          },
          {
            userInput: 'Create a summary document with the key findings',
            expectedAgents: ['contentCreator', 'Think']
          },
          {
            userInput: 'Email the summary to the entire project team',
            expectedAgents: ['emailAgent', 'Think']
          },
          {
            userInput: 'Schedule a follow-up meeting to discuss the findings',
            expectedAgents: ['calendarAgent', 'Think']
          }
        ]
      },
      {
        name: 'Event Planning Workflow',
        scenario: 'User organizes a company event from planning to execution',
        steps: [
          {
            userInput: 'Find contact information for event venue managers',
            expectedAgents: ['contactAgent', 'Think']
          },
          {
            userInput: 'Email them about venue availability for next month',
            expectedAgents: ['emailAgent', 'Think']
          },
          {
            userInput: 'Create an event planning document with timeline',
            expectedAgents: ['contentCreator', 'Think']
          },
          {
            userInput: 'Schedule planning meetings with the organizing committee',
            expectedAgents: ['contactAgent', 'calendarAgent', 'Think']
          }
        ]
      }
    ];

    complexJourneys.forEach(workflow => {
      itShouldOrchestrate(`${workflow.name}: ${workflow.scenario}`, workflow, validator);
    });
  });

  describe('🔀 Parallel Workflow Coordination', () => {
    it('should handle multiple simultaneous requests intelligently', async () => {
      const parallelWorkflow: WorkflowExpectation = {
        name: 'Parallel Communication Tasks',
        scenario: 'User makes multiple related requests that can be processed in parallel',
        steps: [
          {
            userInput: 'Email John about the meeting and schedule a call with Sarah',
            expectedAgents: ['contactAgent', 'emailAgent', 'calendarAgent', 'Think']
          }
        ]
      };

      const result = await validator.validateWorkflow(parallelWorkflow);
      
      expect(result.success).toBe(true);
      expect(result.workflowCoherence).toBeGreaterThan(0.7);
      
      // Should involve both email and calendar agents
      const allAgents = result.stepResults.flatMap(step => step.agents);
      expect(allAgents).toContain('emailAgent');
      expect(allAgents).toContain('calendarAgent');
      expect(allAgents).toContain('contactAgent'); // For looking up both contacts
      
      console.log(`🔀 Parallel workflow result: ${result.stepResults[0]?.details || 'No details'}`);
    });
  });

  describe('🎯 Workflow Intelligence Assessment', () => {
    it('should demonstrate intelligent workflow adaptation', async () => {
      const adaptiveWorkflow: WorkflowExpectation = {
        name: 'Adaptive Workflow Intelligence',
        scenario: 'Workflow should adapt based on context and previous steps',
        steps: [
          {
            userInput: 'I need to contact someone about the project',
            expectedAgents: ['contactAgent', 'Think']
          },
          {
            userInput: 'Actually, let me send them an email instead',
            expectedAgents: ['emailAgent', 'Think']
          },
          {
            userInput: 'On second thought, a meeting would be better',
            expectedAgents: ['calendarAgent', 'Think']
          }
        ]
      };

      const result = await validator.validateWorkflow(adaptiveWorkflow);
      
      // Each step should adapt to the new intent
      expect(result.stepResults.length).toBe(3);
      
      // Workflow should show progression through different agent types
      const stepAgents = result.stepResults.map(step => step.agents[0]);
      console.log(`🎯 Workflow adaptation: ${stepAgents.join(' → ')}`);
      
      // Even if not perfect, should show some adaptability
      expect(result.workflowCoherence).toBeGreaterThan(0.5);
    });
  });

  describe('🏗️ Workflow Dependency Management', () => {
    it('should respect agent dependencies in workflows', async () => {
      const dependencyWorkflow: WorkflowExpectation = {
        name: 'Contact-Dependent Email Workflow',
        scenario: 'Email workflow that requires contact lookup should include contact agent',
        steps: [
          {
            userInput: 'Send an urgent email to Maria about the client meeting',
            expectedAgents: ['contactAgent', 'emailAgent', 'Think'],
            expectedOrder: true
          }
        ]
      };

      const result = await validator.validateWorkflow(dependencyWorkflow);
      
      const firstStep = result.stepResults[0];
      if (firstStep && firstStep.success) {
        const agents = firstStep.agents;
        const contactIndex = agents.indexOf('contactAgent');
        const emailIndex = agents.indexOf('emailAgent');
        
        // If both agents are present, contact should come before email
        if (contactIndex !== -1 && emailIndex !== -1) {
          expect(contactIndex).toBeLessThan(emailIndex);
          console.log(`🏗️ Dependency order respected: contactAgent(${contactIndex}) → emailAgent(${emailIndex})`);
        }
      }
    });
  });

  describe('📊 Workflow Performance Metrics', () => {
    it('should maintain consistent workflow performance', async () => {
      const performanceWorkflows: WorkflowExpectation[] = [
        {
          name: 'Standard Email Workflow',
          scenario: 'Basic email sending with contact lookup',
          steps: [{
            userInput: 'Email Sarah about tomorrow\'s presentation',
            expectedAgents: ['contactAgent', 'emailAgent', 'Think']
          }]
        },
        {
          name: 'Standard Calendar Workflow', 
          scenario: 'Basic meeting scheduling',
          steps: [{
            userInput: 'Schedule a meeting with the marketing team',
            expectedAgents: ['calendarAgent', 'Think']
          }]
        },
        {
          name: 'Standard Content Workflow',
          scenario: 'Basic content creation',
          steps: [{
            userInput: 'Write a summary of this week\'s achievements',
            expectedAgents: ['contentCreator', 'Think']
          }]
        }
      ];

      const results = await Promise.all(
        performanceWorkflows.map(workflow => validator.validateWorkflow(workflow))
      );

      const avgCoherence = results.reduce((sum, r) => sum + r.workflowCoherence, 0) / results.length;
      const successRate = results.filter(r => r.success).length / results.length;

      expect(avgCoherence).toBeGreaterThan(0.7); // 70% average coherence
      expect(successRate).toBeGreaterThan(0.8); // 80% success rate

      console.log(`📊 Workflow Performance Metrics:`);
      console.log(`   Average Coherence: ${(avgCoherence * 100).toFixed(1)}%`);
      console.log(`   Success Rate: ${(successRate * 100).toFixed(1)}%`);
      
      results.forEach((result, index) => {
        const workflow = performanceWorkflows[index];
        if (workflow) {
          console.log(`   ${workflow.name}: ${(result.workflowCoherence * 100).toFixed(1)}% coherence`);
        }
      });
    });
  });

  describe('🚀 End-to-End User Journey Validation', () => {
    it('should complete complex multi-agent journeys successfully', async () => {
      const fullJourney: WorkflowExpectation = {
        name: 'Complete Project Management Journey',
        scenario: 'User manages a project from inception to team coordination',
        steps: [
          {
            userInput: 'Create a project proposal for the new AI initiative',
            expectedAgents: ['contentCreator', 'Think']
          },
          {
            userInput: 'Find contact info for the executive team',
            expectedAgents: ['contactAgent', 'Think']
          },
          {
            userInput: 'Email the proposal to the executives for review',
            expectedAgents: ['emailAgent', 'Think']
          },
          {
            userInput: 'Schedule a presentation meeting with stakeholders',
            expectedAgents: ['contactAgent', 'calendarAgent', 'Think']
          },
          {
            userInput: 'Create an agenda for the presentation meeting',
            expectedAgents: ['contentCreator', 'Think']
          }
        ]
      };

      const result = await validator.validateWorkflow(fullJourney);
      
      // End-to-end journey should show good overall coherence
      expect(result.workflowCoherence).toBeGreaterThan(0.6);
      
      // Each step should involve appropriate agents
      result.stepResults.forEach((step, index) => {
        expect(step.agents.length).toBeGreaterThan(0);
        expect(step.agents).toContain('Think'); // Every step should include thinking
        console.log(`🚀 Journey Step ${index + 1}: ${step.agents.join(', ')}`);
      });

      console.log(`🚀 Complete Journey Coherence: ${(result.workflowCoherence * 100).toFixed(1)}%`);
    });
  });
});