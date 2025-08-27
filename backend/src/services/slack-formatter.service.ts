import { BaseService } from './base-service';
import { SlackBlock, SlackResponse } from '../types/slack.types';

/**
 * Service for formatting responses into Slack Block Kit format
 * Converts agent responses to rich, interactive Slack messages
 */
export class SlackFormatterService extends BaseService {
  
  constructor() {
    super('SlackFormatterService');
  }

  protected async onInitialize(): Promise<void> {
    this.logInfo('Slack formatter service initialized');
  }

  protected async onDestroy(): Promise<void> {
    this.logInfo('Slack formatter service destroyed');
  }

  /**
   * Format a simple text message
   */
  formatTextMessage(text: string): SlackResponse {
    return {
      text,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text
          }
        }
      ]
    };
  }

  /**
   * Format error message - returns blocks array for testing compatibility
   */
  formatErrorMessage(error: string): SlackBlock[] {
    const response = this.formatErrorMessageResponse(error);
    return response.blocks || [];
  }

  /**
   * Format error message response
   */
  formatErrorMessageResponse(error: string): SlackResponse {
    return {
      text: `❌ Error: ${error}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `❌ *Error*\n${error}`
          }
        }
      ]
    };
  }

  /**
   * Format help message - returns blocks array for testing compatibility
   */
  formatHelpMessage(): SlackBlock[] {
    const response = this.formatHelpMessageResponse();
    return response.blocks || [];
  }

  /**
   * Format agent response for Slack
   */
  async formatAgentResponse(
    masterResponse: any, 
    slackContext: any
  ): Promise<{ text: string; blocks?: any[] }> {
    try {
      // Extract the main message from MasterAgent response
      let responseText = masterResponse.message || 'I processed your request successfully.';
      
      // Add tool execution results if available
      if (masterResponse.toolResults && masterResponse.toolResults.length > 0) {
        const results = masterResponse.toolResults
          .filter((tr: any) => tr.success)
          .map((tr: any) => tr.result)
          .filter(Boolean);
        
        if (results.length > 0) {
          responseText += '\n\nResults:\n' + results.map((r: any) => 
            typeof r === 'string' ? r : JSON.stringify(r, null, 2)
          ).join('\n');
        }
      }

      // Create rich Slack blocks for the response
      const blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: responseText
          }
        }
      ];

      // Add interactive buttons for common actions if available
      if (masterResponse.toolCalls && masterResponse.toolCalls.length > 0) {
        const actionButtons = masterResponse.toolCalls
          .filter((tc: any) => tc.name !== 'Think')
          .map((tc: any) => ({
            type: 'button',
            text: {
              type: 'plain_text',
              text: `View ${tc.name} Results`
            },
            value: tc.name,
            action_id: `view_${tc.name.toLowerCase()}_results`
          }));

        if (actionButtons.length > 0) {
          blocks.push({
            type: 'actions',
            elements: actionButtons
          } as any);
        }
      }

      return {
        text: responseText,
        blocks
      };
    } catch (error) {
      this.logError('Error formatting agent response', error);
      return { 
        text: masterResponse.message || 'I processed your request successfully.' 
      };
    }
  }

  /**
   * Format help message response
   */
  formatHelpMessageResponse(): SlackResponse {
    return {
      text: 'AI Assistant Help',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🤖 AI Assistant Help'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'I can help you with:'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '📧 *Email Management*\n• Check your inbox\n• Send emails\n• Search messages\n• Draft responses'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '📅 *Calendar Management*\n• Schedule meetings\n• Check availability\n• Create events\n• Send invitations'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '👤 *Contact Management*\n• Find contacts\n• Look up information\n• Add new contacts'
          }
        },
        {
          type: 'divider'
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Examples:*\n• `/assistant check my email`\n• `/assistant schedule meeting with John tomorrow at 2pm`\n• `/assistant find contact for Jane Smith`'
          }
        }
      ]
    };
  }

  /**
   * Format email summary - returns blocks array for testing compatibility
   */
  formatEmailSummary(emails: any[]): SlackBlock[] {
    const response = this.formatEmailSummaryResponse(emails);
    return response.blocks || [];
  }

  /**
   * Format email summary response
   */
  formatEmailSummaryResponse(emails: any[]): SlackResponse {
    if (!emails.length) {
      return {
        text: 'No emails found',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '📧 *Inbox Summary*\n\nNo new emails found.'
            }
          }
        ]
      };
    }

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📧 Inbox Summary (${emails.length} emails)`
        }
      }
    ];

    emails.slice(0, 5).forEach((email, index) => {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${email.subject || 'No Subject'}*\nFrom: ${email.from}\n${this.truncateText(email.snippet || '', 100)}`
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Read'
          },
          action_id: `read_email_${email.id}`,
          value: email.id
        }
      });

      if (index < emails.length - 1) {
        blocks.push({ type: 'divider' });
      }
    });

    if (emails.length > 5) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `And ${emails.length - 5} more emails...`
          }
        ]
      });
    }

    return {
      text: `Found ${emails.length} emails`,
      blocks
    };
  }

  /**
   * Format calendar events - returns blocks array for testing compatibility
   */
  formatCalendarEvent(events: any[]): SlackBlock[] {
    const response = this.formatCalendarEventsResponse(events);
    return response.blocks || [];
  }

  /**
   * Format calendar events response
   */
  formatCalendarEventsResponse(events: any[]): SlackResponse {
    if (!events.length) {
      return {
        text: 'No events found',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '📅 *Calendar*\n\nNo upcoming events found.'
            }
          }
        ]
      };
    }

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📅 Upcoming Events (${events.length})`
        }
      }
    ];

    events.slice(0, 5).forEach((event, index) => {
      const startTime = new Date(event.start?.dateTime || event.start?.date);
      const endTime = new Date(event.end?.dateTime || event.end?.date);
      
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${event.summary || 'No Title'}*\n📅 ${this.formatDate(startTime)} • ${this.formatTime(startTime)} - ${this.formatTime(endTime)}\n${event.description ? this.truncateText(event.description, 100) : ''}`
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View'
          },
          action_id: `view_event_${event.id}`,
          value: event.id
        }
      });

      if (index < events.length - 1) {
        blocks.push({ type: 'divider' });
      }
    });

    if (events.length > 5) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `And ${events.length - 5} more events...`
          }
        ]
      });
    }

    return {
      text: `Found ${events.length} events`,
      blocks
    };
  }

  /**
   * Format contact information - returns blocks array for testing compatibility
   */
  formatContactInfo(contact: any): SlackBlock[] {
    // Handle both single contact and array input for backward compatibility
    const contacts = Array.isArray(contact) ? contact : [contact];
    const response = this.formatContactInfoResponse(contacts);
    return response.blocks || [];
  }

  /**
   * Format contact information response
   */
  formatContactInfoResponse(contacts: any[]): SlackResponse {
    if (!contacts.length) {
      return {
        text: 'No contacts found',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '👤 *Contacts*\n\nNo matching contacts found.'
            }
          }
        ]
      };
    }

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `👤 Contacts (${contacts.length})`
        }
      }
    ];

    contacts.slice(0, 3).forEach((contact, index) => {
      const name = contact.names?.[0]?.displayName || 'Unknown';
      const email = contact.emailAddresses?.[0]?.value || '';
      const phone = contact.phoneNumbers?.[0]?.value || '';
      
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${name}*\n${email ? `📧 ${email}\n` : ''}${phone ? `📞 ${phone}` : ''}`
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Details'
          },
          action_id: `view_contact_${contact.resourceName}`,
          value: contact.resourceName
        }
      });

      if (index < contacts.length - 1) {
        blocks.push({ type: 'divider' });
      }
    });

    if (contacts.length > 3) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `And ${contacts.length - 3} more contacts...`
          }
        ]
      });
    }

    return {
      text: `Found ${contacts.length} contacts`,
      blocks
    };
  }

  /**
   * Format confirmation message with actions
   */
  formatConfirmationMessage(message: string, confirmAction: string, cancelAction?: string): SlackResponse {
    const elements: any[] = [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Confirm'
        },
        style: 'primary',
        action_id: confirmAction,
        value: 'confirm'
      }
    ];

    if (cancelAction) {
      elements.push({
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Cancel'
        },
        action_id: cancelAction,
        value: 'cancel'
      });
    }

    return {
      text: message,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: message
          }
        },
        {
          type: 'actions',
          elements
        }
      ]
    };
  }

  /**
   * Format success message
   */
  formatSuccessMessage(message: string): SlackResponse {
    return {
      text: `✅ ${message}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `✅ *Success*\n${message}`
          }
        }
      ]
    };
  }

  /**
   * Format loading message
   */
  formatLoadingMessage(action: string): SlackResponse {
    return {
      text: `⏳ ${action}...`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `⏳ ${action}...`
          }
        }
      ]
    };
  }

  /**
   * Utility: Truncate text to specified length
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Utility: Format date
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Utility: Format time
   */
  private formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
}