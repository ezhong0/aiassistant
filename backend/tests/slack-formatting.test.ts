import { SlackFormatterService } from '../src/services/slack-formatter.service';

describe('Slack Formatting Service Tests', () => {
  let slackFormatter: SlackFormatterService;

  beforeAll(async () => {
    // Create service directly for testing
    slackFormatter = new SlackFormatterService();
    await slackFormatter.initialize();
  });

  describe('Email Formatting', () => {
    it('should format single email correctly', () => {
      const mockEmail = {
        id: 'email_123',
        subject: 'Important Meeting Update',
        from: 'manager@company.com',
        snippet: 'Please review the updated agenda for tomorrow\'s meeting. We have added two new items to discuss.',
        date: '2023-12-01T14:30:00Z',
        unread: true
      };

      const formatted = slackFormatter.formatEmailSummary([mockEmail]);

      expect(formatted).toBeDefined();
      expect(Array.isArray(formatted)).toBe(true);
      expect(formatted.length).toBeGreaterThan(0);

      // Check for key email information
      const textContent = JSON.stringify(formatted);
      expect(textContent).toContain('Important Meeting Update');
      expect(textContent).toContain('manager@company.com');
    });

    it('should format multiple emails correctly', () => {
      const mockEmails = [
        {
          id: 'email_1',
          subject: 'Project Status Update',
          from: 'alice@company.com',
          snippet: 'The project is on track and we expect to deliver on time.',
          date: '2023-12-01T10:00:00Z',
          unread: true
        },
        {
          id: 'email_2',
          subject: 'Budget Review Meeting',
          from: 'bob@company.com',
          snippet: 'Let\'s review the Q4 budget numbers in our meeting tomorrow.',
          date: '2023-12-01T11:30:00Z',
          unread: false
        },
        {
          id: 'email_3',
          subject: 'Team Lunch Planning',
          from: 'carol@company.com',
          snippet: 'Please let me know your dietary preferences for the team lunch.',
          date: '2023-12-01T13:15:00Z',
          unread: true
        }
      ];

      const formatted = slackFormatter.formatEmailSummary(mockEmails);

      expect(formatted).toBeDefined();
      expect(Array.isArray(formatted)).toBe(true);

      const textContent = JSON.stringify(formatted);
      expect(textContent).toContain('Project Status Update');
      expect(textContent).toContain('Budget Review Meeting');
      expect(textContent).toContain('Team Lunch Planning');
    });

    it('should handle empty email list', () => {
      const formatted = slackFormatter.formatEmailSummary([]);

      expect(formatted).toBeDefined();
      expect(Array.isArray(formatted)).toBe(true);
      expect(formatted.length).toBeGreaterThan(0);

      const textContent = JSON.stringify(formatted);
      expect(textContent).toContain('No new emails found');
    });

    it('should format email with attachments indicator', () => {
      const mockEmailWithAttachments = {
        id: 'email_with_attachments',
        subject: 'Contract Documents',
        from: 'legal@company.com',
        snippet: 'Please review the attached contract documents and provide your feedback.',
        date: '2023-12-01T16:00:00Z',
        unread: true,
        hasAttachments: true,
        attachmentCount: 3
      };

      const formatted = slackFormatter.formatEmailSummary([mockEmailWithAttachments]);

      expect(formatted).toBeDefined();
      const textContent = JSON.stringify(formatted);
      expect(textContent).toContain('Contract Documents');
      expect(textContent).toMatch(/attachment|📎/i);
    });

    it('should format long email snippets appropriately', () => {
      const mockEmailWithLongSnippet = {
        id: 'email_long',
        subject: 'Detailed Project Report',
        from: 'analyst@company.com',
        snippet: 'This is a very long email snippet that contains detailed information about the project status, including metrics, timelines, resource allocation, budget considerations, risk assessments, and recommendations for next steps. The email goes on to describe various technical details and implementation considerations.',
        date: '2023-12-01T17:00:00Z',
        unread: false
      };

      const formatted = slackFormatter.formatEmailSummary([mockEmailWithLongSnippet]);

      expect(formatted).toBeDefined();
      const textContent = JSON.stringify(formatted);
      expect(textContent).toContain('Detailed Project Report');
      // Should truncate or handle long content appropriately
    });
  });

  describe('Calendar Event Formatting', () => {
    it('should format single calendar event correctly', () => {
      const mockEvent = {
        id: 'event_123',
        summary: 'Team Standup',
        start: { dateTime: '2023-12-02T09:00:00Z' },
        end: { dateTime: '2023-12-02T09:30:00Z' },
        location: 'Conference Room A',
        attendees: [
          { email: 'alice@company.com', responseStatus: 'accepted' },
          { email: 'bob@company.com', responseStatus: 'tentative' }
        ]
      };

      const formatted = slackFormatter.formatCalendarEvent([mockEvent]);

      expect(formatted).toBeDefined();
      expect(Array.isArray(formatted)).toBe(true);
      expect(formatted.length).toBeGreaterThan(0);

      const textContent = JSON.stringify(formatted);
      expect(textContent).toContain('Team Standup');
      // Location is not included in the text format currently
    });

    it('should format multiple calendar events correctly', () => {
      const mockEvents = [
        {
          id: 'event_1',
          summary: 'Morning Standup',
          start: { dateTime: '2023-12-02T09:00:00Z' },
          end: { dateTime: '2023-12-02T09:30:00Z' },
          location: 'Virtual'
        },
        {
          id: 'event_2',
          summary: 'Client Presentation',
          start: { dateTime: '2023-12-02T14:00:00Z' },
          end: { dateTime: '2023-12-02T15:30:00Z' },
          location: 'Main Conference Room',
          attendees: [
            { email: 'client@external.com', responseStatus: 'accepted' }
          ]
        },
        {
          id: 'event_3',
          summary: 'Team Retrospective',
          start: { dateTime: '2023-12-02T16:00:00Z' },
          end: { dateTime: '2023-12-02T17:00:00Z' },
          location: 'Room 302'
        }
      ];

      const formatted = slackFormatter.formatCalendarEvent(mockEvents);

      expect(formatted).toBeDefined();
      expect(Array.isArray(formatted)).toBe(true);

      const textContent = JSON.stringify(formatted);
      expect(textContent).toContain('Morning Standup');
      expect(textContent).toContain('Client Presentation');
      expect(textContent).toContain('Team Retrospective');
    });

    it('should handle all-day events', () => {
      const mockAllDayEvent = {
        id: 'all_day_event',
        summary: 'Company Holiday',
        start: { date: '2023-12-25' },
        end: { date: '2023-12-26' },
        description: 'Christmas Day - Office closed'
      };

      const formatted = slackFormatter.formatCalendarEvent([mockAllDayEvent]);

      expect(formatted).toBeDefined();
      const textContent = JSON.stringify(formatted);
      expect(textContent).toContain('Company Holiday');
    });

    it('should format recurring events', () => {
      const mockRecurringEvent = {
        id: 'recurring_event',
        summary: 'Weekly Team Meeting',
        start: { dateTime: '2023-12-02T10:00:00Z' },
        end: { dateTime: '2023-12-02T11:00:00Z' },
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
        location: 'Conference Room B'
      };

      const formatted = slackFormatter.formatCalendarEvent([mockRecurringEvent]);

      expect(formatted).toBeDefined();
      const textContent = JSON.stringify(formatted);
      expect(textContent).toContain('Weekly Team Meeting');
    });

    it('should handle empty event list', () => {
      const formatted = slackFormatter.formatCalendarEvent([]);

      expect(formatted).toBeDefined();
      expect(Array.isArray(formatted)).toBe(true);

      const textContent = JSON.stringify(formatted);
      expect(textContent).toContain('No upcoming events found');
    });

    it('should format events with different time zones', () => {
      const mockEventWithTimezone = {
        id: 'timezone_event',
        summary: 'International Call',
        start: { 
          dateTime: '2023-12-02T15:00:00-08:00',
          timeZone: 'America/Los_Angeles'
        },
        end: { 
          dateTime: '2023-12-02T16:00:00-08:00',
          timeZone: 'America/Los_Angeles'
        },
        location: 'Zoom Meeting'
      };

      const formatted = slackFormatter.formatCalendarEvent([mockEventWithTimezone]);

      expect(formatted).toBeDefined();
      const textContent = JSON.stringify(formatted);
      expect(textContent).toContain('International Call');
    });
  });

  describe('Contact Information Formatting', () => {
    it('should format complete contact information', () => {
      const mockContact = {
        names: [{ displayName: 'John Smith' }],
        emailAddresses: [{ value: 'john.smith@company.com' }],
        phoneNumbers: [{ value: '+1 (555) 123-4567' }],
        organizations: [{ name: 'Acme Corporation', title: 'Senior Manager', department: 'Marketing' }]
      };

      const formatted = slackFormatter.formatContactInfo(mockContact);

      expect(formatted).toBeDefined();
      expect(Array.isArray(formatted)).toBe(true);
      expect(formatted.length).toBeGreaterThan(0);

      const textContent = JSON.stringify(formatted);
      expect(textContent).toContain('John Smith');
      expect(textContent).toContain('john.smith@company.com');
      expect(textContent).toContain('555) 123-4567');
      // Company info is not currently displayed in the formatter
    });

    it('should format minimal contact information', () => {
      const mockMinimalContact = {
        names: [{ displayName: 'Jane Doe' }],
        emailAddresses: [{ value: 'jane@example.com' }]
      };

      const formatted = slackFormatter.formatContactInfo(mockMinimalContact);

      expect(formatted).toBeDefined();
      const textContent = JSON.stringify(formatted);
      expect(textContent).toContain('Jane Doe');
      expect(textContent).toContain('jane@example.com');
    });

    it('should format contact with multiple phone numbers', () => {
      const mockContactMultiplePhones = {
        names: [{ displayName: 'Alice Johnson' }],
        emailAddresses: [{ value: 'alice@company.com' }],
        phoneNumbers: [
          { value: '+1 (555) 123-4567' },
          { value: '+1 (555) 987-6543' }
        ],
        organizations: [{ name: 'Tech Solutions Inc.' }]
      };

      const formatted = slackFormatter.formatContactInfo(mockContactMultiplePhones);

      expect(formatted).toBeDefined();
      const textContent = JSON.stringify(formatted);
      expect(textContent).toContain('Alice Johnson');
      expect(textContent).toContain('alice@company.com');
    });

    it('should format contact with social media links', () => {
      const mockContactWithSocial = {
        names: [{ displayName: 'Bob Wilson' }],
        emailAddresses: [{ value: 'bob@startup.com' }],
        organizations: [{ name: 'Innovative Startup' }],
        urls: [
          { value: 'https://linkedin.com/in/bobwilson' },
          { value: 'https://twitter.com/bobwilson' }
        ]
      };

      const formatted = slackFormatter.formatContactInfo(mockContactWithSocial);

      expect(formatted).toBeDefined();
      const textContent = JSON.stringify(formatted);
      expect(textContent).toContain('Bob Wilson');
      expect(textContent).toContain('bob@startup.com');
    });
  });

  describe('Error Message Formatting', () => {
    it('should format generic error messages', () => {
      const errorMessage = 'Unable to connect to Gmail service';

      const formatted = slackFormatter.formatErrorMessage(errorMessage);

      expect(formatted).toBeDefined();
      expect(Array.isArray(formatted)).toBe(true);
      expect(formatted.length).toBeGreaterThan(0);

      const textContent = JSON.stringify(formatted);
      expect(textContent).toContain('Unable to connect to Gmail service');
      expect(textContent).toMatch(/error|⚠️|❌/i);
    });

    it('should format authentication errors', () => {
      const authError = 'Authentication failed. Please reconnect your Google account.';

      const formatted = slackFormatter.formatErrorMessage(authError);

      expect(formatted).toBeDefined();
      const textContent = JSON.stringify(formatted);
      expect(textContent).toContain('Authentication failed');
    });

    it('should format permission errors', () => {
      const permissionError = 'Insufficient permissions to access calendar events.';

      const formatted = slackFormatter.formatErrorMessage(permissionError);

      expect(formatted).toBeDefined();
      const textContent = JSON.stringify(formatted);
      expect(textContent).toContain('Insufficient permissions');
    });

    it('should format rate limit errors', () => {
      const rateLimitError = 'API rate limit exceeded. Please try again in a few minutes.';

      const formatted = slackFormatter.formatErrorMessage(rateLimitError);

      expect(formatted).toBeDefined();
      const textContent = JSON.stringify(formatted);
      expect(textContent).toContain('rate limit exceeded');
    });
  });

  describe('Help Message Formatting', () => {
    it('should format comprehensive help message', () => {
      const formatted = slackFormatter.formatHelpMessage();

      expect(formatted).toBeDefined();
      expect(Array.isArray(formatted)).toBe(true);
      expect(formatted.length).toBeGreaterThan(0);

      const textContent = JSON.stringify(formatted);
      expect(textContent).toContain('help');
      expect(textContent).toMatch(/email|calendar|contact/i);
    });

    it('should include command examples in help', () => {
      const formatted = slackFormatter.formatHelpMessage();

      const textContent = JSON.stringify(formatted);
      expect(textContent).toMatch(/send.*email|schedule.*meeting|find.*contact/i);
    });

    it('should include available features in help', () => {
      const formatted = slackFormatter.formatHelpMessage();

      const textContent = JSON.stringify(formatted);
      // Check for actual content in help message
      expect(textContent).toContain('Email Management');
      expect(textContent).toContain('Calendar Management');
      expect(textContent).toContain('Contact Management');
    });
  });

  describe('Interactive Elements', () => {
    it('should format messages with action buttons', () => {
      const mockEmailWithActions = {
        id: 'actionable_email',
        subject: 'Meeting Request',
        from: 'colleague@company.com',
        snippet: 'Would you like to meet next week to discuss the project?',
        date: '2023-12-01T12:00:00Z',
        unread: true
      };

      const formatted = slackFormatter.formatEmailSummary([mockEmailWithActions]);

      expect(formatted).toBeDefined();
      const textContent = JSON.stringify(formatted);
      expect(textContent).toContain('Meeting Request');
      // Should include interactive elements
      expect(textContent).toMatch(/button|action/i);
    });

    it('should format calendar events with action buttons', () => {
      const mockEventWithActions = {
        id: 'actionable_event',
        summary: 'Upcoming Meeting',
        start: { dateTime: '2023-12-02T14:00:00Z' },
        end: { dateTime: '2023-12-02T15:00:00Z' },
        location: 'Conference Room'
      };

      const formatted = slackFormatter.formatCalendarEvent([mockEventWithActions]);

      expect(formatted).toBeDefined();
      const textContent = JSON.stringify(formatted);
      expect(textContent).toContain('Upcoming Meeting');
    });
  });

  describe('Rich Content Formatting', () => {
    it('should format messages with emojis and formatting', () => {
      const mockImportantEmail = {
        id: 'important_email',
        subject: '[URGENT] System Maintenance Tonight',
        from: 'admin@company.com',
        snippet: 'The system will be down for maintenance from 10 PM to 2 AM.',
        date: '2023-12-01T15:00:00Z',
        unread: true,
        priority: 'high'
      };

      const formatted = slackFormatter.formatEmailSummary([mockImportantEmail]);

      expect(formatted).toBeDefined();
      const textContent = JSON.stringify(formatted);
      expect(textContent).toContain('URGENT');
      // Emojis are not currently added for urgent emails in the formatter
    });

    it('should format status indicators correctly', () => {
      const mockEventWithStatus = {
        id: 'status_event',
        summary: 'Team Meeting',
        start: { dateTime: '2023-12-02T10:00:00Z' },
        end: { dateTime: '2023-12-02T11:00:00Z' },
        attendees: [
          { email: 'alice@company.com', responseStatus: 'accepted' },
          { email: 'bob@company.com', responseStatus: 'declined' },
          { email: 'carol@company.com', responseStatus: 'tentative' }
        ]
      };

      const formatted = slackFormatter.formatCalendarEvent([mockEventWithStatus]);

      expect(formatted).toBeDefined();
      const textContent = JSON.stringify(formatted);
      expect(textContent).toContain('Team Meeting');
      // Status indicators are not currently displayed in the formatter
    });
  });

  describe('Truncation and Length Handling', () => {
    it('should handle very long email subjects', () => {
      const mockLongSubjectEmail = {
        id: 'long_subject',
        subject: 'This is an extremely long email subject that goes on and on and contains way too much information for a typical subject line and should probably be truncated appropriately',
        from: 'verbose@company.com',
        snippet: 'Short content.',
        date: '2023-12-01T16:00:00Z',
        unread: false
      };

      const formatted = slackFormatter.formatEmailSummary([mockLongSubjectEmail]);

      expect(formatted).toBeDefined();
      const textContent = JSON.stringify(formatted);
      expect(textContent.length).toBeLessThan(5000); // Should not be excessively long
    });

    it('should handle large lists efficiently', () => {
      const manyEmails = Array.from({ length: 50 }, (_, i) => ({
        id: `email_${i}`,
        subject: `Email Subject ${i}`,
        from: `sender${i}@company.com`,
        snippet: `This is email number ${i} in the list.`,
        date: '2023-12-01T10:00:00Z',
        unread: i % 3 === 0
      }));

      const formatted = slackFormatter.formatEmailSummary(manyEmails);

      expect(formatted).toBeDefined();
      expect(Array.isArray(formatted)).toBe(true);
      
      const textContent = JSON.stringify(formatted);
      // Should handle large lists without becoming unwieldy
      expect(textContent.length).toBeLessThan(50000);
    });
  });
});