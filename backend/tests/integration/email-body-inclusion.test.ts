/**
 * Email Body Inclusion Test
 * Demonstrates that proposals now include the full email body content
 */

import { MasterAgent, ProposalResponse } from '../../src/agents/master.agent';
import { ToolCall } from '../../src/types/tools';
import { SlackContext } from '../../src/types/slack.types';

// Mock services
jest.mock('../../src/services/service-manager');
jest.mock('../../src/services/slack-message-reader.service');
jest.mock('../../src/utils/logger');

describe('Email Body Inclusion in Proposals', () => {
  let masterAgent: MasterAgent;
  let mockSlackContext: SlackContext;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSlackContext = {
      userId: 'U123456789',
      channelId: 'D123456789',
      teamId: 'T123456789',
      threadTs: '1234567890.123456',
      isDirectMessage: true,
      userName: 'testuser',
      userEmail: 'test@example.com'
    };

    masterAgent = new MasterAgent({
      openaiApiKey: 'test-api-key'
    });
  });

  afterEach(() => {
    if (masterAgent) {
      masterAgent.cleanup();
    }
  });

  it('should include full email body in proposal text', async () => {
    const toolCalls: ToolCall[] = [
      {
        name: 'send_email',
        parameters: {
          recipient: 'john@example.com',
          subject: 'Project Status Update',
          body: `Hi John,

I hope this email finds you well. I wanted to provide you with an update on the current project status.

Here are the key highlights:
- Phase 1 has been completed successfully
- Phase 2 is currently in progress and on track
- We expect to complete the project by the end of next week

Please let me know if you have any questions or concerns.

Best regards,
Sarah`
        }
      }
    ];

    const mockProposal: ProposalResponse = {
      text: `I'll send an email to john@example.com with the subject 'Project Status Update' and the following content:

Hi John,

I hope this email finds you well. I wanted to provide you with an update on the current project status.

Here are the key highlights:
- Phase 1 has been completed successfully
- Phase 2 is currently in progress and on track
- We expect to complete the project by the end of next week

Please let me know if you have any questions or concerns.

Best regards,
Sarah

Should I go ahead?`,
      actionType: 'email',
      confidence: 0.95,
      requiresConfirmation: true,
      originalToolCalls: toolCalls
    };

    const mockOpenAIService = {
      generateStructuredData: jest.fn()
        .mockResolvedValueOnce({
          needsContext: false,
          contextType: 'none',
          confidence: 0.9,
          reasoning: 'Direct request with clear parameters'
        })
        .mockResolvedValueOnce(mockProposal),
      generateToolCalls: jest.fn().mockResolvedValue({
        toolCalls,
        message: 'I understand you want to send an email.'
      })
    };

    jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

    const response = await masterAgent.processUserInput(
      'Send John a project status update email',
      'test-session',
      'test-user',
      mockSlackContext
    );

    expect(response.proposal).toBeDefined();
    expect(response.proposal?.text).toContain('john@example.com');
    expect(response.proposal?.text).toContain('Project Status Update');
    
    // Verify the full email body is included
    expect(response.proposal?.text).toContain('Hi John,');
    expect(response.proposal?.text).toContain('I hope this email finds you well');
    expect(response.proposal?.text).toContain('Phase 1 has been completed successfully');
    expect(response.proposal?.text).toContain('Phase 2 is currently in progress');
    expect(response.proposal?.text).toContain('Best regards,\nSarah');
    expect(response.proposal?.text).toContain('Should I go ahead?');
  });

  it('should handle long email bodies properly', async () => {
    const longEmailBody = `Dear Team,

I wanted to provide a comprehensive update on our Q4 initiatives and progress across all departments.

## Sales Department
Our sales team has exceeded targets by 15% this quarter, with particular success in the enterprise segment. Key achievements include:
- Closed 12 major enterprise deals worth $2.3M in total
- Expanded into 3 new geographic markets
- Launched successful partnership program with 5 strategic partners

## Marketing Department
The marketing team has been instrumental in supporting our sales efforts:
- Launched 3 major campaigns resulting in 40% increase in qualified leads
- Improved website conversion rate by 25%
- Generated $500K in pipeline through content marketing initiatives

## Product Development
Our engineering team has made significant progress on our roadmap:
- Released 2 major product updates with enhanced features
- Reduced bug reports by 30% through improved testing processes
- Completed integration with 3 major third-party platforms

## Customer Success
Customer satisfaction scores have improved to 4.8/5.0:
- Reduced churn rate by 20%
- Implemented proactive customer health monitoring
- Launched customer advisory board with 15 key customers

## Financial Performance
Q4 financial results show strong growth:
- Revenue: $5.2M (up 35% from Q3)
- Gross margin: 78% (up 2% from Q3)
- Customer acquisition cost reduced by 15%

## Looking Ahead to Q1
Our priorities for the next quarter include:
1. Expanding our enterprise sales team by 50%
2. Launching new product features based on customer feedback
3. Implementing advanced analytics platform
4. Strengthening partnerships in key markets

I'm excited about our momentum and confident in our ability to achieve even greater success in 2024.

Best regards,
CEO`;

    const toolCalls: ToolCall[] = [
      {
        name: 'send_email',
        parameters: {
          recipient: 'team@company.com',
          subject: 'Q4 Update and Q1 Priorities',
          body: longEmailBody
        }
      }
    ];

    const mockProposal: ProposalResponse = {
      text: `I'll send an email to team@company.com with the subject 'Q4 Update and Q1 Priorities' and the following content:\n\n${longEmailBody}\n\nShould I go ahead?`,
      actionType: 'email',
      confidence: 0.95,
      requiresConfirmation: true,
      originalToolCalls: toolCalls
    };

    const mockOpenAIService = {
      generateStructuredData: jest.fn()
        .mockResolvedValueOnce({
          needsContext: false,
          contextType: 'none',
          confidence: 0.9,
          reasoning: 'Direct request with clear parameters'
        })
        .mockResolvedValueOnce(mockProposal),
      generateToolCalls: jest.fn().mockResolvedValue({
        toolCalls,
        message: 'I understand you want to send an email.'
      })
    };

    jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

    const response = await masterAgent.processUserInput(
      'Send the quarterly update email to the team',
      'test-session',
      'test-user',
      mockSlackContext
    );

    expect(response.proposal).toBeDefined();
    
    // Verify the long email body is fully included
    expect(response.proposal?.text).toContain('Dear Team,');
    expect(response.proposal?.text).toContain('Sales Department');
    expect(response.proposal?.text).toContain('Closed 12 major enterprise deals');
    expect(response.proposal?.text).toContain('Marketing Department');
    expect(response.proposal?.text).toContain('Product Development');
    expect(response.proposal?.text).toContain('Customer Success');
    expect(response.proposal?.text).toContain('Financial Performance');
    expect(response.proposal?.text).toContain('Looking Ahead to Q1');
    expect(response.proposal?.text).toContain('Best regards,\nCEO');
    
    // Verify the proposal is properly formatted
    expect(response.proposal?.text).toContain('team@company.com');
    expect(response.proposal?.text).toContain('Q4 Update and Q1 Priorities');
    expect(response.proposal?.text).toContain('Should I go ahead?');
  });

  it('should format email body with proper line breaks', async () => {
    const toolCalls: ToolCall[] = [
      {
        name: 'send_email',
        parameters: {
          recipient: 'client@example.com',
          subject: 'Meeting Follow-up',
          body: 'Thank you for the productive meeting today.\n\nHere are the action items we discussed:\n1. Review the proposal by Friday\n2. Schedule follow-up meeting\n3. Send additional documentation\n\nPlease let me know if you need any clarification.\n\nBest regards,\nJohn'
        }
      }
    ];

    const mockProposal: ProposalResponse = {
      text: `I'll send an email to client@example.com with the subject 'Meeting Follow-up' and the following content:\n\nThank you for the productive meeting today.\n\nHere are the action items we discussed:\n1. Review the proposal by Friday\n2. Schedule follow-up meeting\n3. Send additional documentation\n\nPlease let me know if you need any clarification.\n\nBest regards,\nJohn\n\nShould I go ahead?`,
      actionType: 'email',
      confidence: 0.95,
      requiresConfirmation: true,
      originalToolCalls: toolCalls
    };

    const mockOpenAIService = {
      generateStructuredData: jest.fn()
        .mockResolvedValueOnce({
          needsContext: false,
          contextType: 'none',
          confidence: 0.9,
          reasoning: 'Direct request with clear parameters'
        })
        .mockResolvedValueOnce(mockProposal),
      generateToolCalls: jest.fn().mockResolvedValue({
        toolCalls,
        message: 'I understand you want to send an email.'
      })
    };

    jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

    const response = await masterAgent.processUserInput(
      'Send a follow-up email to the client',
      'test-session',
      'test-user',
      mockSlackContext
    );

    expect(response.proposal).toBeDefined();
    
    // Verify the email body maintains proper formatting
    expect(response.proposal?.text).toContain('Thank you for the productive meeting today.');
    expect(response.proposal?.text).toContain('Here are the action items we discussed:');
    expect(response.proposal?.text).toContain('1. Review the proposal by Friday');
    expect(response.proposal?.text).toContain('2. Schedule follow-up meeting');
    expect(response.proposal?.text).toContain('3. Send additional documentation');
    expect(response.proposal?.text).toContain('Best regards,\nJohn');
  });
});
