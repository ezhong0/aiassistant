/**
 * Tests for proposal parsing accuracy
 * Tests various proposal formats and parsing edge cases
 */

import { SlackInterfaceService } from '../../src/services/slack-interface.service';

describe('Proposal Parsing Accuracy', () => {
  let slackInterface: SlackInterfaceService;

  const mockSlackConfig = {
    signingSecret: 'test-secret',
    botToken: 'xoxb-test-token',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'http://localhost:3000/auth/callback',
    development: true
  };

  beforeEach(async () => {
    slackInterface = new SlackInterfaceService(mockSlackConfig);
    await slackInterface.initialize();
  });

  afterEach(async () => {
    await slackInterface.destroy();
  });

  describe('Email Proposal Parsing', () => {
    const emailProposals = [
      {
        text: 'I\'ll send an email to john@example.com with subject "Meeting Reminder" and body "Don\'t forget about our meeting tomorrow."',
        expected: {
          actionType: 'email',
          action: 'send',
          recipient: 'john@example.com',
          subject: 'Meeting Reminder',
          body: 'Don\'t forget about our meeting tomorrow.'
        }
      },
      {
        text: 'I\'ll compose an email to jane@company.com with subject "Project Update" and body "Here\'s the latest status on our project."',
        expected: {
          actionType: 'email',
          action: 'send',
          recipient: 'jane@company.com',
          subject: 'Project Update',
          body: 'Here\'s the latest status on our project.'
        }
      },
      {
        text: 'I\'ll draft an email to boss@company.com with subject "Weekly Report" and body "This week we completed the following tasks."',
        expected: {
          actionType: 'email',
          action: 'send',
          recipient: 'boss@company.com',
          subject: 'Weekly Report',
          body: 'This week we completed the following tasks.'
        }
      },
      {
        text: 'I\'ll send email to client@external.com with subject "Proposal" and body "Please find attached our proposal for your project."',
        expected: {
          actionType: 'email',
          action: 'send',
          recipient: 'client@external.com',
          subject: 'Proposal',
          body: 'Please find attached our proposal for your project.'
        }
      },
      {
        text: 'I\'ll send an email to team@startup.io with subject "Sprint Planning" and body "Let\'s schedule our next sprint planning meeting."',
        expected: {
          actionType: 'email',
          action: 'send',
          recipient: 'team@startup.io',
          subject: 'Sprint Planning',
          body: 'Let\'s schedule our next sprint planning meeting.'
        }
      }
    ];

    it.each(emailProposals)('should parse email proposal: "$text"', ({ text, expected }) => {
      const parseProposalActionSpy = jest.spyOn(slackInterface as any, 'parseProposalAction');
      const result = parseProposalActionSpy(text);

      expect(result).toEqual(expected);
    });

    it('should handle email proposals without explicit body', () => {
      const text = 'I\'ll send an email to john@example.com with subject "Meeting Reminder"';
      const parseProposalActionSpy = jest.spyOn(slackInterface as any, 'parseProposalAction');
      const result = parseProposalActionSpy(text);

      expect(result).toEqual({
        actionType: 'email',
        action: 'send',
        recipient: 'john@example.com',
        subject: 'Meeting Reminder',
        body: 'No body content'
      });
    });

    it('should handle email proposals without explicit subject', () => {
      const text = 'I\'ll send an email to john@example.com with body "Don\'t forget about our meeting tomorrow."';
      const parseProposalActionSpy = jest.spyOn(slackInterface as any, 'parseProposalAction');
      const result = parseProposalActionSpy(text);

      expect(result).toEqual({
        actionType: 'email',
        action: 'send',
        recipient: 'john@example.com',
        subject: 'No subject',
        body: 'Don\'t forget about our meeting tomorrow.'
      });
    });

    it('should handle email proposals with only recipient', () => {
      const text = 'I\'ll send an email to john@example.com';
      const parseProposalActionSpy = jest.spyOn(slackInterface as any, 'parseProposalAction');
      const result = parseProposalActionSpy(text);

      expect(result).toEqual({
        actionType: 'email',
        action: 'send',
        recipient: 'john@example.com',
        subject: 'No subject',
        body: 'No body content'
      });
    });
  });

  describe('Calendar Proposal Parsing', () => {
    const calendarProposals = [
      {
        text: 'I\'ll schedule a meeting "Project Review" at 2:00 PM tomorrow',
        expected: {
          actionType: 'calendar',
          action: 'create',
          title: 'Project Review',
          time: '2:00 PM tomorrow'
        }
      },
      {
        text: 'I\'ll create a calendar event "Team Standup" at 9:00 AM daily',
        expected: {
          actionType: 'calendar',
          action: 'create',
          title: 'Team Standup',
          time: '9:00 AM daily'
        }
      },
      {
        text: 'I\'ll schedule a meeting "Client Call" at 3:30 PM on Friday',
        expected: {
          actionType: 'calendar',
          action: 'create',
          title: 'Client Call',
          time: '3:30 PM on Friday'
        }
        },
      {
        text: 'I\'ll create a calendar event "Sprint Planning" at 10:00 AM next Monday',
        expected: {
          actionType: 'calendar',
          action: 'create',
          title: 'Sprint Planning',
          time: '10:00 AM next Monday'
        }
      },
      {
        text: 'I\'ll schedule a meeting "Budget Review" at 1:00 PM this afternoon',
        expected: {
          actionType: 'calendar',
          action: 'create',
          title: 'Budget Review',
          time: '1:00 PM this afternoon'
        }
      }
    ];

    it.each(calendarProposals)('should parse calendar proposal: "$text"', ({ text, expected }) => {
      const parseProposalActionSpy = jest.spyOn(slackInterface as any, 'parseProposalAction');
      const result = parseProposalActionSpy(text);

      expect(result).toEqual(expected);
    });

    it('should handle calendar proposals without explicit time', () => {
      const text = 'I\'ll schedule a meeting "Project Review"';
      const parseProposalActionSpy = jest.spyOn(slackInterface as any, 'parseProposalAction');
      const result = parseProposalActionSpy(text);

      expect(result).toEqual({
        actionType: 'calendar',
        action: 'create',
        title: 'Project Review',
        time: null
      });
    });

    it('should handle calendar proposals with generic title', () => {
      const text = 'I\'ll schedule a meeting at 2:00 PM tomorrow';
      const parseProposalActionSpy = jest.spyOn(slackInterface as any, 'parseProposalAction');
      const result = parseProposalActionSpy(text);

      expect(result).toEqual({
        actionType: 'calendar',
        action: 'create',
        title: 'Meeting',
        time: '2:00 PM tomorrow'
      });
    });
  });

  describe('Contact Proposal Parsing', () => {
    const contactProposals = [
      {
        text: 'I\'ll add contact "John Doe" with email john@example.com',
        expected: {
          actionType: 'contact',
          action: 'create',
          name: 'John Doe',
          email: 'john@example.com'
        }
      },
      {
        text: 'I\'ll create contact "Jane Smith" with email jane@company.com',
        expected: {
          actionType: 'contact',
          action: 'create',
          name: 'Jane Smith',
          email: 'jane@company.com'
        }
      },
      {
        text: 'I\'ll add contact "Bob Johnson" with email bob@startup.io',
        expected: {
          actionType: 'contact',
          action: 'create',
          name: 'Bob Johnson',
          email: 'bob@startup.io'
        }
      },
      {
        text: 'I\'ll create contact "Alice Brown" with email alice@external.com',
        expected: {
          actionType: 'contact',
          action: 'create',
          name: 'Alice Brown',
          email: 'alice@external.com'
        }
      }
    ];

    it.each(contactProposals)('should parse contact proposal: "$text"', ({ text, expected }) => {
      const parseProposalActionSpy = jest.spyOn(slackInterface as any, 'parseProposalAction');
      const result = parseProposalActionSpy(text);

      expect(result).toEqual(expected);
    });

    it('should handle contact proposals without explicit email', () => {
      const text = 'I\'ll add contact "John Doe"';
      const parseProposalActionSpy = jest.spyOn(slackInterface as any, 'parseProposalAction');
      const result = parseProposalActionSpy(text);

      expect(result).toEqual({
        actionType: 'contact',
        action: 'create',
        name: 'John Doe',
        email: null
      });
    });

    it('should handle contact proposals with generic name', () => {
      const text = 'I\'ll add contact with email john@example.com';
      const parseProposalActionSpy = jest.spyOn(slackInterface as any, 'parseProposalAction');
      const result = parseProposalActionSpy(text);

      expect(result).toEqual({
        actionType: 'contact',
        action: 'create',
        name: 'New Contact',
        email: 'john@example.com'
      });
    });
  });

  describe('Unparseable Proposals', () => {
    const unparseableProposals = [
      'I\'ll do something unclear',
      'I\'ll help you with that',
      'I\'ll take care of it',
      'I\'ll handle the request',
      'I\'ll process your request',
      'I\'ll work on that',
      'I\'ll get back to you',
      'I\'ll look into it',
      'I\'ll check on that',
      'I\'ll investigate the issue',
      'I\'ll review the document',
      'I\'ll analyze the data',
      'I\'ll prepare the report',
      'I\'ll organize the files',
      'I\'ll clean up the code',
      'I\'ll fix the bug',
      'I\'ll update the system',
      'I\'ll configure the settings',
      'I\'ll install the software',
      'I\'ll deploy the application'
    ];

    it.each(unparseableProposals)('should return null for unparseable proposal: "$text"', (text) => {
      const parseProposalActionSpy = jest.spyOn(slackInterface as any, 'parseProposalAction');
      const result = parseProposalActionSpy(text);

      expect(result).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      const parseProposalActionSpy = jest.spyOn(slackInterface as any, 'parseProposalAction');
      const result = parseProposalActionSpy('');

      expect(result).toBeNull();
    });

    it('should handle whitespace-only strings', () => {
      const parseProposalActionSpy = jest.spyOn(slackInterface as any, 'parseProposalAction');
      const result = parseProposalActionSpy('   ');

      expect(result).toBeNull();
    });

    it('should handle very long strings', () => {
      const longString = 'I\'ll send an email to john@example.com with subject "Meeting Reminder" and body "'.repeat(1000) + '"';
      const parseProposalActionSpy = jest.spyOn(slackInterface as any, 'parseProposalAction');
      const result = parseProposalActionSpy(longString);

      expect(result).toBeNull();
    });

    it('should handle special characters in email addresses', () => {
      const text = 'I\'ll send an email to john+test@example.com with subject "Test"';
      const parseProposalActionSpy = jest.spyOn(slackInterface as any, 'parseProposalAction');
      const result = parseProposalActionSpy(text);

      expect(result).toEqual({
        actionType: 'email',
        action: 'send',
        recipient: 'john+test@example.com',
        subject: 'Test',
        body: 'No body content'
      });
    });

    it('should handle special characters in subjects and bodies', () => {
      const text = 'I\'ll send an email to john@example.com with subject "Meeting @ 2:00 PM!" and body "Don\'t forget about our meeting tomorrow. See you there! 🎉"';
      const parseProposalActionSpy = jest.spyOn(slackInterface as any, 'parseProposalAction');
      const result = parseProposalActionSpy(text);

      expect(result).toEqual({
        actionType: 'email',
        action: 'send',
        recipient: 'john@example.com',
        subject: 'Meeting @ 2:00 PM!',
        body: 'Don\'t forget about our meeting tomorrow. See you there! 🎉'
      });
    });

    it('should handle case sensitivity', () => {
      const text = 'I\'LL SEND AN EMAIL TO JOHN@EXAMPLE.COM WITH SUBJECT "MEETING REMINDER" AND BODY "DON\'T FORGET ABOUT OUR MEETING TOMORROW."';
      const parseProposalActionSpy = jest.spyOn(slackInterface as any, 'parseProposalAction');
      const result = parseProposalActionSpy(text);

      expect(result).toEqual({
        actionType: 'email',
        action: 'send',
        recipient: 'JOHN@EXAMPLE.COM',
        subject: 'MEETING REMINDER',
        body: 'DON\'T FORGET ABOUT OUR MEETING TOMORROW.'
      });
    });

    it('should handle multiple email addresses (should pick first one)', () => {
      const text = 'I\'ll send an email to john@example.com and jane@company.com with subject "Meeting Reminder"';
      const parseProposalActionSpy = jest.spyOn(slackInterface as any, 'parseProposalAction');
      const result = parseProposalActionSpy(text);

      expect(result).toEqual({
        actionType: 'email',
        action: 'send',
        recipient: 'john@example.com',
        subject: 'Meeting Reminder',
        body: 'No body content'
      });
    });

    it('should handle malformed email addresses', () => {
      const text = 'I\'ll send an email to not-an-email with subject "Test"';
      const parseProposalActionSpy = jest.spyOn(slackInterface as any, 'parseProposalAction');
      const result = parseProposalActionSpy(text);

      expect(result).toEqual({
        actionType: 'email',
        action: 'send',
        recipient: null,
        subject: 'Test',
        body: 'No body content'
      });
    });
  });

  describe('Tool Call Creation', () => {
    it('should create correct tool call for email action', () => {
      const actionDetails = {
        actionType: 'email',
        action: 'send',
        recipient: 'john@example.com',
        subject: 'Meeting Reminder',
        body: 'Don\'t forget about our meeting tomorrow.'
      };

      const createToolCallFromActionSpy = jest.spyOn(slackInterface as any, 'createToolCallFromAction');
      const result = createToolCallFromActionSpy(actionDetails);

      expect(result).toEqual({
        name: 'email_agent',
        parameters: {
          action: 'send',
          recipient: 'john@example.com',
          subject: 'Meeting Reminder',
          body: 'Don\'t forget about our meeting tomorrow.'
        }
      });
    });

    it('should create correct tool call for calendar action', () => {
      const actionDetails = {
        actionType: 'calendar',
        action: 'create',
        title: 'Project Review',
        time: '2:00 PM tomorrow'
      };

      const createToolCallFromActionSpy = jest.spyOn(slackInterface as any, 'createToolCallFromAction');
      const result = createToolCallFromActionSpy(actionDetails);

      expect(result).toEqual({
        name: 'calendar_agent',
        parameters: {
          action: 'create',
          title: 'Project Review',
          time: '2:00 PM tomorrow'
        }
      });
    });

    it('should create correct tool call for contact action', () => {
      const actionDetails = {
        actionType: 'contact',
        action: 'create',
        name: 'John Doe',
        email: 'john@example.com'
      };

      const createToolCallFromActionSpy = jest.spyOn(slackInterface as any, 'createToolCallFromAction');
      const result = createToolCallFromActionSpy(actionDetails);

      expect(result).toEqual({
        name: 'contact_agent',
        parameters: {
          action: 'create',
          name: 'John Doe',
          email: 'john@example.com'
        }
      });
    });

    it('should return null for unknown action types', () => {
      const actionDetails = {
        actionType: 'unknown',
        action: 'do_something'
      };

      const createToolCallFromActionSpy = jest.spyOn(slackInterface as any, 'createToolCallFromAction');
      const result = createToolCallFromActionSpy(actionDetails);

      expect(result).toBeNull();
    });
  });

  describe('Performance Tests', () => {
    it('should parse proposals quickly', () => {
      const testProposals = [
        'I\'ll send an email to john@example.com with subject "Test" and body "Test body"',
        'I\'ll schedule a meeting "Test Meeting" at 2:00 PM',
        'I\'ll add contact "John Doe" with email john@example.com',
        'I\'ll do something unclear',
        'I\'ll help you with that'
      ];

      const startTime = Date.now();
      
      for (const proposal of testProposals) {
        const parseProposalActionSpy = jest.spyOn(slackInterface as any, 'parseProposalAction');
        parseProposalActionSpy(proposal);
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / testProposals.length;

      // Should be very fast - less than 1ms per parsing on average
      expect(averageTime).toBeLessThan(1);
    });

    it('should handle many concurrent parsing requests', () => {
      const promises = [];
      const testProposal = 'I\'ll send an email to john@example.com with subject "Test"';

      // Create 100 concurrent parsing requests
      for (let i = 0; i < 100; i++) {
        const parseProposalActionSpy = jest.spyOn(slackInterface as any, 'parseProposalAction');
        promises.push(parseProposalActionSpy(testProposal));
      }

      const startTime = Date.now();
      const results = Promise.all(promises);
      const endTime = Date.now();

      // All should parse successfully
      expect(results).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actionType: 'email',
            action: 'send',
            recipient: 'john@example.com'
          })
        ])
      );
      
      // Should complete quickly even with many concurrent requests
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});
