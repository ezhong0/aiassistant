/**
 * Tests for confirmation detection accuracy
 * Tests various confirmation response patterns and edge cases
 */

import { SlackInterfaceService } from '../../src/services/slack-interface.service';

describe('Confirmation Detection Accuracy', () => {
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

  describe('Positive Confirmation Patterns', () => {
    const positiveConfirmations = [
      // Simple affirmations
      'yes',
      'y',
      'yeah',
      'yep',
      'sure',
      'ok',
      'okay',
      'go ahead',
      'send it',
      'do it',
      'execute',
      'confirm',
      'approved',
      
      // With punctuation
      'yes!',
      'ok.',
      'sure.',
      'go ahead!',
      
      // With additional words
      'yes, send it',
      'yes, go ahead',
      'yes, do it',
      'yes, execute',
      'yes, confirm',
      'yes, approve',
      'ok, send it',
      'sure, go ahead',
      
      // With capitalization variations
      'YES',
      'OK',
      'SURE',
      'GO AHEAD',
      'SEND IT',
      
      // With extra whitespace
      '  yes  ',
      '  ok  ',
      '  sure  ',
      
      // With contractions
      'yep, send it',
      'yeah, go ahead',
      
      // With emphasis
      'yes please',
      'ok please',
      'sure thing',
      'go for it',
      'proceed',
      'continue',
      'carry on'
    ];

    it.each(positiveConfirmations)('should detect "%s" as positive confirmation', async (response) => {
      const isConfirmationResponseSpy = jest.spyOn(slackInterface as any, 'isConfirmationResponse');
      const result = await isConfirmationResponseSpy(response, {
        userId: 'U123456',
        channelId: 'D123456',
        teamId: 'T123456',
        isDirectMessage: true
      });

      expect(result).toBe(true);
    });

    it.each(positiveConfirmations)('should parse "%s" as positive confirmation', (response) => {
      const parseConfirmationResponseSpy = jest.spyOn(slackInterface as any, 'parseConfirmationResponse');
      const result = parseConfirmationResponseSpy(response);

      expect(result).toBe(true);
    });
  });

  describe('Negative Confirmation Patterns', () => {
    const negativeConfirmations = [
      // Simple negations
      'no',
      'n',
      'nope',
      'cancel',
      'stop',
      'abort',
      'reject',
      'denied',
      
      // With punctuation
      'no!',
      'cancel.',
      'stop.',
      
      // With additional words
      'no, don\'t',
      'no, do not',
      'no, stop',
      'no, cancel',
      'no, abort',
      'don\'t do it',
      'do not send',
      'stop the process',
      'cancel the action',
      
      // With capitalization variations
      'NO',
      'CANCEL',
      'STOP',
      'ABORT',
      'REJECT',
      
      // With extra whitespace
      '  no  ',
      '  cancel  ',
      '  stop  ',
      
      // With contractions
      'nope, don\'t',
      'nah, stop',
      
      // With emphasis
      'no way',
      'absolutely not',
      'definitely not',
      'not at all',
      'never mind',
      'forget it',
      'skip it'
    ];

    it.each(negativeConfirmations)('should detect "%s" as negative confirmation', async (response) => {
      const isConfirmationResponseSpy = jest.spyOn(slackInterface as any, 'isConfirmationResponse');
      const result = await isConfirmationResponseSpy(response, {
        userId: 'U123456',
        channelId: 'D123456',
        teamId: 'T123456',
        isDirectMessage: true
      });

      expect(result).toBe(true);
    });

    it.each(negativeConfirmations)('should parse "%s" as negative confirmation', (response) => {
      const parseConfirmationResponseSpy = jest.spyOn(slackInterface as any, 'parseConfirmationResponse');
      const result = parseConfirmationResponseSpy(response);

      expect(result).toBe(false);
    });
  });

  describe('Non-Confirmation Messages', () => {
    const nonConfirmations = [
      // Regular questions
      'hello',
      'how are you',
      'what can you do',
      'help me',
      'what time is it',
      
      // Requests
      'send an email to john@example.com',
      'schedule a meeting',
      'add a contact',
      'create a calendar event',
      
      // Statements
      'I need help',
      'this is important',
      'I have a question',
      'can you help me',
      
      // Ambiguous responses
      'maybe',
      'perhaps',
      'I think so',
      'probably',
      'possibly',
      
      // Partial words
      'y',
      'n',
      'ok',
      
      // With context that changes meaning
      'yes, I understand',
      'no, I don\'t understand',
      'ok, I see',
      'sure, I know',
      
      // Questions
      'yes?',
      'no?',
      'ok?',
      
      // Long responses
      'yes, but I want to make sure this is correct',
      'no, because I think there might be an issue',
      'ok, but can you explain what will happen',
      
      // Mixed responses
      'yes and no',
      'ok but maybe',
      'sure but not sure',
      
      // Technical terms
      'yes, the API is working',
      'no, the database is down',
      'ok, the service is running',
      
      // Emojis and special characters
      '👍',
      '👎',
      '✅',
      '❌',
      'yes 👍',
      'no 👎',
      
      // Numbers
      '1',
      '2',
      'yes 1',
      'no 2',
      
      // URLs and emails
      'yes, send to john@example.com',
      'no, don\'t send to https://example.com',
      
      // Code snippets
      'yes, run the code',
      'no, don\'t execute the script',
      
      // Multi-line responses
      'yes\n\nplease proceed',
      'no\n\nstop the process',
      
      // Empty or whitespace only
      '',
      '   ',
      '\n',
      '\t'
    ];

    it.each(nonConfirmations)('should not detect "%s" as confirmation', async (response) => {
      const isConfirmationResponseSpy = jest.spyOn(slackInterface as any, 'isConfirmationResponse');
      const result = await isConfirmationResponseSpy(response, {
        userId: 'U123456',
        channelId: 'D123456',
        teamId: 'T123456',
        isDirectMessage: true
      });

      expect(result).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', async () => {
      const isConfirmationResponseSpy = jest.spyOn(slackInterface as any, 'isConfirmationResponse');
      const result = await isConfirmationResponseSpy('', {
        userId: 'U123456',
        channelId: 'D123456',
        teamId: 'T123456',
        isDirectMessage: true
      });

      expect(result).toBe(false);
    });

    it('should handle whitespace-only strings', async () => {
      const isConfirmationResponseSpy = jest.spyOn(slackInterface as any, 'isConfirmationResponse');
      const result = await isConfirmationResponseSpy('   ', {
        userId: 'U123456',
        channelId: 'D123456',
        teamId: 'T123456',
        isDirectMessage: true
      });

      expect(result).toBe(false);
    });

    it('should handle very long strings', async () => {
      const longString = 'yes '.repeat(1000);
      const isConfirmationResponseSpy = jest.spyOn(slackInterface as any, 'isConfirmationResponse');
      const result = await isConfirmationResponseSpy(longString, {
        userId: 'U123456',
        channelId: 'D123456',
        teamId: 'T123456',
        isDirectMessage: true
      });

      expect(result).toBe(false);
    });

    it('should handle special characters', async () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const isConfirmationResponseSpy = jest.spyOn(slackInterface as any, 'isConfirmationResponse');
      const result = await isConfirmationResponseSpy(specialChars, {
        userId: 'U123456',
        channelId: 'D123456',
        teamId: 'T123456',
        isDirectMessage: true
      });

      expect(result).toBe(false);
    });

    it('should handle unicode characters', async () => {
      const unicodeString = 'はい'; // Japanese "yes"
      const isConfirmationResponseSpy = jest.spyOn(slackInterface as any, 'isConfirmationResponse');
      const result = await isConfirmationResponseSpy(unicodeString, {
        userId: 'U123456',
        channelId: 'D123456',
        teamId: 'T123456',
        isDirectMessage: true
      });

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
        const isConfirmationResponseSpy = jest.spyOn(slackInterface as any, 'isConfirmationResponse');
        const result = await isConfirmationResponseSpy(testCase.input, {
          userId: 'U123456',
          channelId: 'D123456',
          teamId: 'T123456',
          isDirectMessage: true
        });

        expect(result).toBe(testCase.expected);
      }
    });

    it('should handle ambiguous responses by defaulting to positive', () => {
      const ambiguousResponses = [
        'maybe',
        'perhaps',
        'I think so',
        'probably',
        'possibly',
        'sounds good',
        'looks good',
        'seems ok'
      ];

      for (const response of ambiguousResponses) {
        const parseConfirmationResponseSpy = jest.spyOn(slackInterface as any, 'parseConfirmationResponse');
        const result = parseConfirmationResponseSpy(response);

        // Should default to positive for ambiguous responses
        expect(result).toBe(true);
      }
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
        const isConfirmationResponseSpy = jest.spyOn(slackInterface as any, 'isConfirmationResponse');
        await isConfirmationResponseSpy(response, {
          userId: 'U123456',
          channelId: 'D123456',
          teamId: 'T123456',
          isDirectMessage: true
        });
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / testResponses.length;

      // Should be very fast - less than 1ms per detection on average
      expect(averageTime).toBeLessThan(1);
    });

    it('should handle many concurrent detections', async () => {
      const promises = [];
      const testResponse = 'yes';

      // Create 100 concurrent detection requests
      for (let i = 0; i < 100; i++) {
        const isConfirmationResponseSpy = jest.spyOn(slackInterface as any, 'isConfirmationResponse');
        promises.push(
          isConfirmationResponseSpy(testResponse, {
            userId: 'U123456',
            channelId: 'D123456',
            teamId: 'T123456',
            isDirectMessage: true
          })
        );
      }

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const endTime = Date.now();

      // All should be detected as confirmations
      expect(results.every(result => result === true)).toBe(true);
      
      // Should complete quickly even with many concurrent requests
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});
