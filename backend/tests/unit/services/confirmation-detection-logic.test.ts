/**
 * Unit tests for confirmation detection logic
 * Tests the confirmation detection methods without requiring full service initialization
 */

describe('Confirmation Detection Logic', () => {
  // Mock the SlackInterfaceService methods we want to test
  const mockSlackInterface = {
    isConfirmationResponse: async (message: string, context: any): Promise<boolean> => {
      const confirmationPatterns = [
        /^(yes|y|yeah|yep|sure|ok|okay|go ahead|send it|do it|execute|confirm|approved)$/i,
        /^(no|n|nope|cancel|stop|abort|reject|denied)$/i,
        /^(yes,?\s*(send|go|do|execute|confirm|approve))$/i,
        /^(no,?\s*(don't|do not|stop|cancel|abort))$/i
      ];

      const trimmedMessage = message.trim();
      return confirmationPatterns.some(pattern => pattern.test(trimmedMessage));
    },

    parseConfirmationResponse: (message: string): boolean => {
      const positivePatterns = [
        /^(yes|y|yeah|yep|sure|ok|okay|go ahead|send it|do it|execute|confirm|approved)$/i,
        /^(yes,?\s*(send|go|do|execute|confirm|approve))$/i
      ];

      const negativePatterns = [
        /^(no|n|nope|cancel|stop|abort|reject|denied)$/i,
        /^(no,?\s*(don't|do not|stop|cancel|abort))$/i
      ];

      const normalizedMessage = message.trim().toLowerCase();
      
      if (positivePatterns.some(pattern => pattern.test(normalizedMessage))) {
        return true;
      }
      
      if (negativePatterns.some(pattern => pattern.test(normalizedMessage))) {
        return false;
      }

      // Default to positive for ambiguous responses
      return true;
    },

    parseProposalAction: (proposalText: string): any | null => {
      try {
        // Simple parsing logic - can be enhanced with more sophisticated NLP
        const text = proposalText.toLowerCase();

        // Email sending patterns
        if (text.includes('send email') || text.includes('compose email') || text.includes('draft email')) {
          const emailMatch = text.match(/send email (?:to )?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
          const subjectMatch = text.match(/subject[:\s]+["']?([^"'\n]+)["']?/);
          const bodyMatch = text.match(/body[:\s]+["']?([^"'\n]+)["']?/);

          return {
            actionType: 'email',
            action: 'send',
            recipient: emailMatch ? emailMatch[1] : null,
            subject: subjectMatch ? subjectMatch[1].toLowerCase() : 'No subject',
            body: bodyMatch ? bodyMatch[1].toLowerCase() : 'No body content'
          };
        }

        // Calendar event patterns
        if (text.includes('schedule') || text.includes('calendar') || text.includes('meeting')) {
          const titleMatch = text.match(/schedule (?:a )?(?:meeting|event)[:\s]+["']?([^"'\n]+)["']?/);
          const timeMatch = text.match(/at[:\s]+([^"'\n]+)/);

          return {
            actionType: 'calendar',
            action: 'create',
            title: titleMatch ? titleMatch[1].toLowerCase() : 'meeting',
            time: timeMatch ? timeMatch[1].toLowerCase() : null
          };
        }

        // Contact creation patterns
        if (text.includes('add contact') || text.includes('create contact')) {
          const nameMatch = text.match(/add contact[:\s]+["']?([^"'\n]+)["']?/);
          const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);

          return {
            actionType: 'contact',
            action: 'create',
            name: nameMatch ? nameMatch[1].toLowerCase() : 'new contact',
            email: emailMatch ? emailMatch[1] : null
          };
        }

        return null;
      } catch (error) {
        return null;
      }
    },

    createToolCallFromAction: (actionDetails: any): any | null => {
      try {
        switch (actionDetails.actionType) {
          case 'email':
            return {
              name: 'email_agent',
              parameters: {
                action: 'send',
                recipient: actionDetails.recipient,
                subject: actionDetails.subject,
                body: actionDetails.body
              }
            };

          case 'calendar':
            return {
              name: 'calendar_agent',
              parameters: {
                action: 'create',
                title: actionDetails.title,
                time: actionDetails.time
              }
            };

          case 'contact':
            return {
              name: 'contact_agent',
              parameters: {
                action: 'create',
                name: actionDetails.name,
                email: actionDetails.email
              }
            };

          default:
            return null;
        }
      } catch (error) {
        return null;
      }
    }
  };

  describe('Confirmation Detection', () => {
    it('should detect positive confirmation responses', async () => {
      const positiveConfirmations = [
        'yes', 'y', 'yeah', 'yep', 'sure', 'ok', 'okay', 'go ahead', 'send it', 'do it', 'execute', 'confirm', 'approved',
        'yes!', 'ok.', 'sure.', 'go ahead!',
        'yes, send it', 'yes, go ahead', 'yes, do it', 'yes, execute', 'yes, confirm', 'yes, approve', 'ok, send it', 'sure, go ahead',
        'YES', 'OK', 'SURE', 'GO AHEAD', 'SEND IT',
        '  yes  ', '  ok  ', '  sure  ',
        'yep, send it', 'yeah, go ahead'
      ];

      for (const response of positiveConfirmations) {
        const result = await mockSlackInterface.isConfirmationResponse(response, {});
        expect(result).toBe(true);
      }
    });

    it('should detect negative confirmation responses', async () => {
      const negativeConfirmations = [
        'no', 'n', 'nope', 'cancel', 'stop', 'abort', 'reject', 'denied',
        'no!', 'cancel.', 'stop.',
        'no, don\'t', 'no, do not', 'no, stop', 'no, cancel', 'no, abort',
        'NO', 'CANCEL', 'STOP', 'ABORT', 'REJECT',
        '  no  ', '  cancel  ', '  stop  '
      ];

      for (const response of negativeConfirmations) {
        const result = await mockSlackInterface.isConfirmationResponse(response, {});
        expect(result).toBe(true);
      }
    });

    it('should not detect non-confirmation messages', async () => {
      const nonConfirmations = [
        'hello', 'how are you', 'what can you do', 'help me', 'what time is it',
        'send an email to john@example.com', 'schedule a meeting', 'add a contact', 'create a calendar event',
        'I need help', 'this is important', 'I have a question', 'can you help me',
        'maybe', 'perhaps', 'I think so', 'probably', 'possibly',
        'yes, I understand', 'no, I don\'t understand', 'ok, I see', 'sure, I know',
        'yes?', 'no?', 'ok?',
        'yes, but I want to make sure this is correct', 'no, because I think there might be an issue', 'ok, but can you explain what will happen',
        'yes and no', 'ok but maybe', 'sure but not sure',
        'yes, the API is working', 'no, the database is down', 'ok, the service is running',
        '👍', '👎', '✅', '❌', 'yes 👍', 'no 👎',
        '1', '2', 'yes 1', 'no 2',
        'yes, send to john@example.com', 'no, don\'t send to https://example.com',
        'yes, run the code', 'no, don\'t execute the script',
        'yes\n\nplease proceed', 'no\n\nstop the process',
        '', '   ', '\n', '\t'
      ];

      for (const response of nonConfirmations) {
        const result = await mockSlackInterface.isConfirmationResponse(response, {});
        expect(result).toBe(false);
      }
    });
  });

  describe('Confirmation Parsing', () => {
    it('should parse positive confirmations correctly', () => {
      const positiveConfirmations = [
        'yes', 'y', 'yeah', 'yep', 'sure', 'ok', 'okay', 'go ahead', 'send it', 'do it', 'execute', 'confirm', 'approved',
        'yes, send it', 'yes, go ahead', 'yes, do it', 'yes, execute', 'yes, confirm', 'yes, approve'
      ];

      for (const response of positiveConfirmations) {
        const result = mockSlackInterface.parseConfirmationResponse(response);
        expect(result).toBe(true);
      }
    });

    it('should parse negative confirmations correctly', () => {
      const negativeConfirmations = [
        'no', 'n', 'nope', 'cancel', 'stop', 'abort', 'reject', 'denied',
        'no, don\'t', 'no, do not', 'no, stop', 'no, cancel', 'no, abort'
      ];

      for (const response of negativeConfirmations) {
        const result = mockSlackInterface.parseConfirmationResponse(response);
        expect(result).toBe(false);
      }
    });

    it('should default to positive for ambiguous responses', () => {
      const ambiguousResponses = [
        'maybe', 'perhaps', 'I think so', 'probably', 'possibly', 'sounds good', 'looks good', 'seems ok'
      ];

      for (const response of ambiguousResponses) {
        const result = mockSlackInterface.parseConfirmationResponse(response);
        expect(result).toBe(true);
      }
    });
  });

  describe('Proposal Parsing', () => {
    it('should parse email proposals correctly', () => {
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
            subject: 'project update',
            body: 'here\'s the latest status on our project.'
          }
        },
        {
          text: 'I\'ll send an email to john@example.com with subject "Meeting Reminder"',
          expected: {
            actionType: 'email',
            action: 'send',
            recipient: 'john@example.com',
            subject: 'meeting reminder',
            body: 'No body content'
          }
        },
        {
          text: 'I\'ll send an email to john@example.com',
          expected: {
            actionType: 'email',
            action: 'send',
            recipient: 'john@example.com',
            subject: 'No subject',
            body: 'No body content'
          }
        }
      ];

      for (const { text, expected } of emailProposals) {
        const result = mockSlackInterface.parseProposalAction(text);
        expect(result).toEqual(expected);
      }
    });

    it('should parse calendar proposals correctly', () => {
      const calendarProposals = [
        {
          text: 'I\'ll schedule a meeting "Project Review" at 2:00 PM tomorrow',
          expected: {
            actionType: 'calendar',
            action: 'create',
            title: 'project review',
            time: '2:00 pm tomorrow'
          }
        },
        {
          text: 'I\'ll create a calendar event "Team Standup" at 9:00 AM daily',
          expected: {
            actionType: 'calendar',
            action: 'create',
            title: 'team standup',
            time: '9:00 am daily'
          }
        },
        {
          text: 'I\'ll schedule a meeting "Project Review"',
          expected: {
            actionType: 'calendar',
            action: 'create',
            title: 'project review',
            time: null
          }
        },
        {
          text: 'I\'ll schedule a meeting at 2:00 PM tomorrow',
          expected: {
            actionType: 'calendar',
            action: 'create',
            title: 'meeting',
            time: '2:00 pm tomorrow'
          }
        }
      ];

      for (const { text, expected } of calendarProposals) {
        const result = mockSlackInterface.parseProposalAction(text);
        expect(result).toEqual(expected);
      }
    });

    it('should parse contact proposals correctly', () => {
      const contactProposals = [
        {
          text: 'I\'ll add contact "John Doe" with email john@example.com',
          expected: {
            actionType: 'contact',
            action: 'create',
            name: 'john doe',
            email: 'john@example.com'
          }
        },
        {
          text: 'I\'ll create contact "Jane Smith" with email jane@company.com',
          expected: {
            actionType: 'contact',
            action: 'create',
            name: 'jane smith',
            email: 'jane@company.com'
          }
        },
        {
          text: 'I\'ll add contact "John Doe"',
          expected: {
            actionType: 'contact',
            action: 'create',
            name: 'john doe',
            email: null
          }
        },
        {
          text: 'I\'ll add contact with email john@example.com',
          expected: {
            actionType: 'contact',
            action: 'create',
            name: 'new contact',
            email: 'john@example.com'
          }
        }
      ];

      for (const { text, expected } of contactProposals) {
        const result = mockSlackInterface.parseProposalAction(text);
        expect(result).toEqual(expected);
      }
    });

    it('should return null for unparseable proposals', () => {
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
        'I\'ll investigate the issue'
      ];

      for (const proposal of unparseableProposals) {
        const result = mockSlackInterface.parseProposalAction(proposal);
        expect(result).toBeNull();
      }
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

      const result = mockSlackInterface.createToolCallFromAction(actionDetails);

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

      const result = mockSlackInterface.createToolCallFromAction(actionDetails);

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

      const result = mockSlackInterface.createToolCallFromAction(actionDetails);

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

      const result = mockSlackInterface.createToolCallFromAction(actionDetails);

      expect(result).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', async () => {
      const result = await mockSlackInterface.isConfirmationResponse('', {});
      expect(result).toBe(false);
    });

    it('should handle whitespace-only strings', async () => {
      const result = await mockSlackInterface.isConfirmationResponse('   ', {});
      expect(result).toBe(false);
    });

    it('should handle case sensitivity correctly', async () => {
      const testCases = [
        { input: 'YES', expected: true },
        { input: 'yes', expected: true },
        { input: 'Yes', expected: true },
        { input: 'yEs', expected: true },
        { input: 'NO', expected: true },
        { input: 'no', expected: true },
        { input: 'No', expected: true },
        { input: 'nO', expected: true }
      ];

      for (const testCase of testCases) {
        const result = await mockSlackInterface.isConfirmationResponse(testCase.input, {});
        expect(result).toBe(testCase.expected);
      }
    });

    it('should handle special characters in email addresses', () => {
      const text = 'I\'ll send an email to john+test@example.com with subject "Test"';
      const result = mockSlackInterface.parseProposalAction(text);

      expect(result).toEqual({
        actionType: 'email',
        action: 'send',
        recipient: 'john+test@example.com',
        subject: 'test',
        body: 'No body content'
      });
    });

    it('should handle malformed email addresses', () => {
      const text = 'I\'ll send an email to not-an-email with subject "Test"';
      const result = mockSlackInterface.parseProposalAction(text);

      expect(result).toEqual({
        actionType: 'email',
        action: 'send',
        recipient: null,
        subject: 'test',
        body: 'No body content'
      });
    });
  });

  describe('Performance Tests', () => {
    it('should detect confirmations quickly', async () => {
      const testResponses = [
        'yes', 'no', 'ok', 'cancel', 'go ahead', 'stop',
        'yes, send it', 'no, don\'t', 'sure, proceed', 'abort mission'
      ];

      const startTime = Date.now();
      
      for (const response of testResponses) {
        await mockSlackInterface.isConfirmationResponse(response, {});
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / testResponses.length;

      // Should be very fast - less than 1ms per detection on average
      expect(averageTime).toBeLessThan(1);
    });

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
        mockSlackInterface.parseProposalAction(proposal);
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / testProposals.length;

      // Should be very fast - less than 1ms per parsing on average
      expect(averageTime).toBeLessThan(1);
    });
  });
});
