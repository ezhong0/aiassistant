import { BaseService } from './base-service';
import { SlackBlock, SlackResponse, ActionProposal } from '../types/slack.types';

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
    // Check if this is an authentication error
    const isAuthError = error.includes('Access token is required') || 
                       error.includes('authentication') || 
                       error.includes('unauthorized');

    const blocks: any[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `❌ *Error*\n${error}`
        }
      }
    ];

    // Add authentication button for auth errors
    if (isAuthError) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🔐 *Authentication Required*\n\nTo send emails, you need to connect your Gmail account. Click the button below to authenticate securely with Google.`
        }
      });
      
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🔑 Connect Gmail Account'
            },
            style: 'primary',
            action_id: 'gmail_oauth',
            url: `${process.env.BASE_URL || 'https://aiassistant-production-5333.up.railway.app'}/auth/google/slack`
          }
        ]
      });
    }

    return {
      text: `❌ Error: ${error}`,
      blocks
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
   * Format a rich proposal card showing exactly what will happen
   * This creates detailed proposal cards for confirmation workflows
   */
  formatProposalCard(proposal: ActionProposal): SlackResponse {
    try {
      const blocks: SlackBlock[] = [];
      
      // Header with action type and title
      blocks.push({
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${this.getActionEmoji(proposal.type)} ${proposal.title}`
        }
      });

      // Summary section
      if (proposal.summary) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Summary*\n${proposal.summary}`
          }
        });
      }

      // Details section - show exactly what will happen
      if (proposal.details) {
        blocks.push({ type: 'divider' });
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*What will happen:*\n${this.formatProposalDetails(proposal.details, proposal.type)}`
          }
        });
      }

      // Risks and considerations
      if (proposal.risks && proposal.risks.length > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*⚠️ Important:*\n${proposal.risks.map(risk => `• ${risk}`).join('\n')}`
          }
        });
      }

      // Alternative options
      if (proposal.alternatives && proposal.alternatives.length > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Other options:*\n${proposal.alternatives.map(alt => `• ${alt}`).join('\n')}`
          }
        });
      }

      // Action buttons
      blocks.push({ type: 'divider' });
      blocks.push({
        type: 'actions',
        elements: proposal.actions.map(action => ({
          type: 'button',
          text: {
            type: 'plain_text',
            text: action.text
          },
          style: action.style || 'default',
          action_id: action.actionId,
          value: action.actionId
        }))
      });

      return {
        text: `${proposal.title}: ${proposal.summary || 'Action requires confirmation'}`,
        blocks
      };

    } catch (error) {
      this.logError('Error formatting proposal card', error);
      return this.formatErrorMessageResponse('Failed to format proposal card');
    }
  }

  /**
   * Generate a proposal card from tool calls and preview results
   * This creates rich proposal cards showing exactly what will happen
   */
  generateProposalFromToolCalls(
    toolCalls: any[], 
    previewResults: any[], 
    userCommand: string
  ): ActionProposal | null {
    try {
      // Find the main action tool (skip Think and contact lookup tools)
      const mainAction = toolCalls.find(tc => 
        tc.name !== 'Think' && 
        tc.name !== 'contactAgent' &&
        tc.name !== 'tavilyAgent'
      );
      
      if (!mainAction) {
        return null;
      }
      
      // Generate proposal based on the main action type
      switch (mainAction.name) {
        case 'emailAgent':
          return this.generateEmailProposal(mainAction, previewResults, userCommand);
        
        case 'calendarAgent':
          return this.generateCalendarProposal(mainAction, previewResults, userCommand);
        
        case 'contactAgent':
          return this.generateContactProposal(mainAction, previewResults, userCommand);
        
        case 'contentCreator':
          return this.generateContentProposal(mainAction, previewResults, userCommand);
        
        default:
          return this.generateGenericProposal(mainAction, previewResults, userCommand);
      }
      
    } catch (error) {
      this.logError('Error generating proposal from tool calls', error);
      return null;
    }
  }

  /**
   * Generate email proposal card
   */
  private generateEmailProposal(mainAction: any, previewResults: any[], userCommand: string): ActionProposal {
    const emailParams = mainAction.parameters;
    const contactResults = previewResults.find(r => r.toolName === 'contactAgent');
    
    // Determine email type and details
    let emailType: 'email_send' | 'email_reply' | 'email_forward' | 'email_draft' = 'email_send';
    let details: any = {};
    
    if (emailParams.query?.toLowerCase().includes('reply')) {
      emailType = 'email_reply';
      details = {
        threadId: emailParams.threadId,
        originalSubject: emailParams.subject,
        body: emailParams.body,
        includeOriginal: true
      };
    } else if (emailParams.query?.toLowerCase().includes('forward')) {
      emailType = 'email_forward';
      details = {
        to: emailParams.recipients,
        subject: emailParams.subject,
        body: emailParams.body
      };
    } else if (emailParams.query?.toLowerCase().includes('draft')) {
      emailType = 'email_draft';
      details = {
        to: this.extractRecipients(emailParams, contactResults),
        subject: emailParams.subject,
        body: emailParams.body
      };
    } else {
      // Regular email send
      emailType = 'email_send';
      details = {
        to: this.extractRecipients(emailParams, contactResults),
        subject: emailParams.subject,
        body: emailParams.body,
        attachments: emailParams.attachments || [],
        scheduledTime: emailParams.scheduledTime || 'Send immediately'
      };
    }
    
    return {
      type: emailType,
      title: this.getEmailActionTitle(emailType),
      summary: `Send email about: ${emailParams.query || 'your request'}`,
      details,
      risks: [
        'Email will be sent immediately and cannot be recalled',
        'Recipients will see your email address',
        'Email content will be stored in Gmail'
      ],
      alternatives: [
        'Save as draft for later editing',
        'Schedule to send later',
        'Send to yourself first for review'
      ],
      actions: [
        {
          actionId: 'confirm',
          text: 'Send Email',
          style: 'primary'
        },
        {
          actionId: 'edit',
          text: 'Edit First',
          style: 'default'
        },
        {
          actionId: 'draft',
          text: 'Save as Draft',
          style: 'default'
        },
        {
          actionId: 'cancel',
          text: 'Cancel',
          style: 'danger'
        }
      ]
    };
  }

  /**
   * Generate calendar proposal card
   */
  private generateCalendarProposal(mainAction: any, previewResults: any[], userCommand: string): ActionProposal {
    const calendarParams = mainAction.parameters;
    const contactResults = previewResults.find(r => r.toolName === 'contactAgent');
    
    // Extract calendar details
    const details = {
      title: calendarParams.title || calendarParams.summary || 'Meeting',
      startTime: calendarParams.startTime || calendarParams.start,
      endTime: calendarParams.endTime || calendarParams.end,
      duration: calendarParams.duration,
      attendees: this.extractAttendees(calendarParams, contactResults),
      location: calendarParams.location,
      description: calendarParams.description,
      reminders: ['15 minutes before', '1 hour before']
    };
    
    return {
      type: 'calendar_create',
      title: 'Create Calendar Event',
      summary: `Schedule: ${details.title}`,
      details,
      risks: [
        'Event will be created immediately',
        'Attendees will receive invitations',
        'Event will be visible on your calendar'
      ],
      alternatives: [
        'Create as tentative event',
        'Schedule for a different time',
        'Create recurring event'
      ],
      actions: [
        {
          actionId: 'confirm',
          text: 'Create Event',
          style: 'primary'
        },
        {
          actionId: 'edit',
          text: 'Edit Details',
          style: 'default'
        },
        {
          actionId: 'tentative',
          text: 'Mark as Tentative',
          style: 'default'
        },
        {
          actionId: 'cancel',
          text: 'Cancel',
          style: 'danger'
        }
      ]
    };
  }

  /**
   * Generate contact proposal card
   */
  private generateContactProposal(mainAction: any, previewResults: any[], userCommand: string): ActionProposal {
    const contactParams = mainAction.parameters;
    
    const details = {
      name: contactParams.name,
      email: contactParams.email,
      phone: contactParams.phone,
      company: contactParams.company,
      notes: contactParams.notes
    };
    
    return {
      type: 'contact_create',
      title: 'Create Contact',
      summary: `Add new contact: ${details.name || 'Unknown'}`,
      details,
      risks: [
        'Contact will be added to your Google Contacts',
        'Information will be synced across devices'
      ],
      alternatives: [
        'Search existing contacts first',
        'Add to a specific contact group',
        'Import from another source'
      ],
      actions: [
        {
          actionId: 'confirm',
          text: 'Create Contact',
          style: 'primary'
        },
        {
          actionId: 'edit',
          text: 'Edit Details',
          style: 'default'
        },
        {
          actionId: 'cancel',
          text: 'Cancel',
          style: 'danger'
        }
      ]
    };
  }

  /**
   * Generate content creation proposal card
   */
  private generateContentProposal(mainAction: any, previewResults: any[], userCommand: string): ActionProposal {
    const contentParams = mainAction.parameters;
    
    const details = {
      topic: contentParams.topic,
      format: contentParams.format || 'blog post',
      length: contentParams.length || 'medium',
      tone: contentParams.tone || 'professional',
      outline: contentParams.outline || []
    };
    
    return {
      type: 'content_create',
      title: 'Create Content',
      summary: `Generate ${details.format} about: ${details.topic}`,
      details,
      risks: [
        'Content will be generated using AI',
        'May require human review and editing',
        'Content quality depends on input parameters'
      ],
      alternatives: [
        'Start with an outline first',
        'Use a different tone or style',
        'Generate multiple versions'
      ],
      actions: [
        {
          actionId: 'confirm',
          text: 'Generate Content',
          style: 'primary'
        },
        {
          actionId: 'outline',
          text: 'Create Outline First',
          style: 'default'
        },
        {
          actionId: 'edit',
          text: 'Edit Parameters',
          style: 'default'
        },
        {
          actionId: 'cancel',
          text: 'Cancel',
          style: 'danger'
        }
      ]
    };
  }

  /**
   * Generate generic proposal card
   */
  private generateGenericProposal(mainAction: any, previewResults: any[], userCommand: string): ActionProposal {
    return {
      type: 'search_perform',
      title: `Execute ${mainAction.name}`,
      summary: `Perform action: ${mainAction.parameters.query || 'your request'}`,
      details: mainAction.parameters,
      risks: [
        'Action will be executed immediately',
        'Results may affect your data or settings'
      ],
      alternatives: [
        'Preview results first',
        'Execute in test mode',
        'Cancel the action'
      ],
      actions: [
        {
          actionId: 'confirm',
          text: 'Execute',
          style: 'primary'
        },
        {
          actionId: 'preview',
          text: 'Preview First',
          style: 'default'
        },
        {
          actionId: 'cancel',
          text: 'Cancel',
          style: 'danger'
        }
      ]
    };
  }

  /**
   * Extract recipients from email parameters and contact results
   */
  private extractRecipients(emailParams: any, contactResults: any): string[] {
    const recipients: string[] = [];
    
    // Add direct email addresses
    if (emailParams.contactEmail) {
      recipients.push(emailParams.contactEmail);
    }
    
    // Add recipients from contact lookup
    if (contactResults && contactResults.result && contactResults.success) {
      if (Array.isArray(contactResults.result)) {
        contactResults.result.forEach((contact: any) => {
          if (contact.email) {
            recipients.push(contact.email);
          }
        });
      } else if (contactResults.result.email) {
        recipients.push(contactResults.result.email);
      }
    }
    
    // Add any other recipients
    if (emailParams.recipients && Array.isArray(emailParams.recipients)) {
      recipients.push(...emailParams.recipients);
    }
    
    return recipients.length > 0 ? recipients : ['Recipient to be determined'];
  }

  /**
   * Extract attendees from calendar parameters and contact results
   */
  private extractAttendees(calendarParams: any, contactResults: any): string[] {
    const attendees: string[] = [];
    
    // Add direct attendees
    if (calendarParams.attendees && Array.isArray(calendarParams.attendees)) {
      attendees.push(...calendarParams.attendees);
    }
    
    // Add attendees from contact lookup
    if (contactResults && contactResults.result && contactResults.success) {
      if (Array.isArray(contactResults.result)) {
        contactResults.result.forEach((contact: any) => {
          if (contact.email) {
            attendees.push(contact.email);
          }
        });
      } else if (contactResults.result.email) {
        attendees.push(contactResults.result.email);
      }
    }
    
    return attendees.length > 0 ? attendees : ['Attendees to be determined'];
  }

  /**
   * Get email action title based on type
   */
  private getEmailActionTitle(emailType: string): string {
    const titles: Record<string, string> = {
      'email_send': 'Send Email',
      'email_reply': 'Reply to Email',
      'email_forward': 'Forward Email',
      'email_draft': 'Create Email Draft'
    };
    
    return titles[emailType] || 'Email Action';
  }

  /**
   * Format proposal details based on action type
   * This shows exactly what will happen in a user-friendly format
   */
  private formatProposalDetails(details: any, actionType: string): string {
    switch (actionType) {
      case 'email_send':
        return this.formatEmailProposalDetails(details);
      
      case 'email_reply':
        return this.formatEmailReplyProposalDetails(details);
      
      case 'calendar_create':
        return this.formatCalendarProposalDetails(details);
      
      case 'calendar_update':
        return this.formatCalendarUpdateProposalDetails(details);
      
      case 'contact_create':
        return this.formatContactProposalDetails(details);
      
      case 'content_create':
        return this.formatContentProposalDetails(details);
      
      default:
        return this.formatGenericProposalDetails(details);
    }
  }

  /**
   * Format email send proposal details
   * Shows exactly: to, subject, body preview, attachments, etc.
   */
  private formatEmailProposalDetails(details: any): string {
    const lines: string[] = [];
    
    if (details.to) {
      lines.push(`*To:* ${Array.isArray(details.to) ? details.to.join(', ') : details.to}`);
    }
    
    if (details.cc && details.cc.length > 0) {
      lines.push(`*CC:* ${details.cc.join(', ')}`);
    }
    
    if (details.bcc && details.bcc.length > 0) {
      lines.push(`*BCC:* ${details.bcc.join(', ')}`);
    }
    
    if (details.subject) {
      lines.push(`*Subject:* ${details.subject}`);
    }
    
    if (details.body) {
      const bodyPreview = details.body.length > 200 
        ? details.body.substring(0, 200) + '...'
        : details.body;
      lines.push(`*Body:*\n${bodyPreview}`);
    }
    
    if (details.attachments && details.attachments.length > 0) {
      lines.push(`*Attachments:* ${details.attachments.length} file(s)`);
      details.attachments.forEach((att: any, index: number) => {
        lines.push(`  ${index + 1}. ${att.name || att.filename || 'Unnamed file'} (${att.size || 'Unknown size'})`);
      });
    }
    
    if (details.scheduledTime) {
      lines.push(`*Scheduled:* ${details.scheduledTime}`);
    } else {
      lines.push(`*Scheduled:* Send immediately`);
    }
    
    return lines.join('\n');
  }

  /**
   * Format email reply proposal details
   */
  private formatEmailReplyProposalDetails(details: any): string {
    const lines: string[] = [];
    
    if (details.threadId) {
      lines.push(`*Reply to:* Thread ${details.threadId.substring(0, 8)}...`);
    }
    
    if (details.originalSubject) {
      lines.push(`*Original Subject:* ${details.originalSubject}`);
    }
    
    if (details.body) {
      const bodyPreview = details.body.length > 200 
        ? details.body.substring(0, 200) + '...'
        : details.body;
      lines.push(`*Reply Body:*\n${bodyPreview}`);
    }
    
    if (details.includeOriginal) {
      lines.push(`*Include original message:* Yes`);
    }
    
    return lines.join('\n');
  }

  /**
   * Format calendar event creation proposal details
   */
  private formatCalendarProposalDetails(details: any): string {
    const lines: string[] = [];
    
    if (details.title) {
      lines.push(`*Event Title:* ${details.title}`);
    }
    
    if (details.startTime) {
      lines.push(`*Start Time:* ${details.startTime}`);
    }
    
    if (details.endTime) {
      lines.push(`*End Time:* ${details.endTime}`);
    }
    
    if (details.duration) {
      lines.push(`*Duration:* ${details.duration} minutes`);
    }
    
    if (details.attendees && details.attendees.length > 0) {
      lines.push(`*Attendees:* ${details.attendees.join(', ')}`);
    }
    
    if (details.location) {
      lines.push(`*Location:* ${details.location}`);
    }
    
    if (details.description) {
      const descPreview = details.description.length > 150 
        ? details.description.substring(0, 150) + '...'
        : details.description;
      lines.push(`*Description:*\n${descPreview}`);
    }
    
    if (details.reminders) {
      lines.push(`*Reminders:* ${details.reminders.join(', ')}`);
    }
    
    return lines.join('\n');
  }

  /**
   * Format calendar update proposal details
   */
  private formatCalendarUpdateProposalDetails(details: any): string {
    const lines: string[] = [];
    
    if (details.eventId) {
      lines.push(`*Event ID:* ${details.eventId.substring(0, 8)}...`);
    }
    
    if (details.originalTitle) {
      lines.push(`*Original Title:* ${details.originalTitle}`);
    }
    
    if (details.newTitle) {
      lines.push(`*New Title:* ${details.newTitle}`);
    }
    
    if (details.changes) {
      lines.push(`*Changes:*\n${details.changes.map((change: any) => `• ${change.field}: ${change.oldValue} → ${change.newValue}`).join('\n')}`);
    }
    
    return lines.join('\n');
  }

  /**
   * Format contact creation proposal details
   */
  private formatContactProposalDetails(details: any): string {
    const lines: string[] = [];
    
    if (details.name) {
      lines.push(`*Name:* ${details.name}`);
    }
    
    if (details.email) {
      lines.push(`*Email:* ${details.email}`);
    }
    
    if (details.phone) {
      lines.push(`*Phone:* ${details.phone}`);
    }
    
    if (details.company) {
      lines.push(`*Company:* ${details.company}`);
    }
    
    if (details.notes) {
      lines.push(`*Notes:* ${details.notes}`);
    }
    
    return lines.join('\n');
  }

  /**
   * Format content creation proposal details
   */
  private formatContentProposalDetails(details: any): string {
    const lines: string[] = [];
    
    if (details.topic) {
      lines.push(`*Topic:* ${details.topic}`);
    }
    
    if (details.format) {
      lines.push(`*Format:* ${details.format}`);
    }
    
    if (details.length) {
      lines.push(`*Length:* ${details.length}`);
    }
    
    if (details.tone) {
      lines.push(`*Tone:* ${details.tone}`);
    }
    
    if (details.outline) {
      lines.push(`*Outline:*\n${details.outline.map((item: any, index: number) => `${index + 1}. ${item}`).join('\n')}`);
    }
    
    return lines.join('\n');
  }

  /**
   * Format generic proposal details
   */
  private formatGenericProposalDetails(details: any): string {
    if (typeof details === 'string') {
      return details;
    }
    
    if (typeof details === 'object') {
      return Object.entries(details)
        .map(([key, value]) => `*${this.capitalizeFirst(key)}:* ${value}`)
        .join('\n');
    }
    
    return String(details);
  }

  /**
   * Get appropriate emoji for action type
   */
  private getActionEmoji(actionType: string): string {
    const emojiMap = {
      'email_send': '📧',
      'email_reply': '↩️',
      'email_forward': '↪️',
      'email_draft': '📝',
      'calendar_create': '📅',
      'calendar_update': '✏️',
      'calendar_delete': '🗑️',
      'contact_create': '👤',
      'contact_update': '✏️',
      'content_create': '✍️',
      'search_perform': '🔍',
      'default': '⚡'
    } as const;
    
    return (emojiMap[actionType as keyof typeof emojiMap] ?? emojiMap.default) as string;
  }

  /**
   * Capitalize first letter of string
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
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

  /**
   * Demo method to show how proposal cards work
   * This creates example proposal cards for testing
   */
  createDemoProposal(): ActionProposal {
    return {
      type: 'email_send',
      title: 'Send Email',
      summary: 'Send email about: quarterly review meeting',
      details: {
        to: 'john@company.com',
        subject: 'Q4 Quarterly Review Meeting',
        body: 'Hi John,\n\nI wanted to schedule our quarterly review meeting for next week. Let me know what time works best for you.\n\nBest regards,\n[Your Name]',
        attachments: [
          { name: 'Q4_Review_Agenda.pdf', size: '2.3 MB' },
          { name: 'Q4_Metrics_Summary.xlsx', size: '1.1 MB' }
        ],
        scheduledTime: 'Send immediately'
      },
      risks: [
        'Email will be sent immediately and cannot be recalled',
        'Recipients will see your email address',
        'Email content will be stored in Gmail'
      ],
      alternatives: [
        'Save as draft for later editing',
        'Schedule to send later',
        'Send to yourself first for review'
      ],
      actions: [
        {
          actionId: 'confirm',
          text: 'Send Email',
          style: 'primary'
        },
        {
          actionId: 'edit',
          text: 'Edit First',
          style: 'default'
        },
        {
          actionId: 'draft',
          text: 'Save as Draft',
          style: 'default'
        },
        {
          actionId: 'cancel',
          text: 'Cancel',
          style: 'danger'
        }
      ]
    };
  }
}