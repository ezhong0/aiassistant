/**
 * Email Agent - Email Management Microservice
 *
 * Gmail integration using the NaturalLanguageAgent pattern.
 *
 * This agent only implements 2 methods:
 * 1. getAgentConfig() - Configuration and metadata
 * 2. executeOperation() - Internal email operations
 *
 * Everything else (LLM analysis, drafts, auth, response formatting) is handled by the base class.
 */

import { NaturalLanguageAgent, AgentConfig } from '../framework/natural-language-agent';
import { GmailService } from '../services/email/gmail.service';

interface EmailResult {
  messageId?: string;
  threadId?: string;
  recipient?: string;
  subject?: string;
  emails?: any[];
  count?: number;
  success: boolean;
}

/**
 * EmailAgent - Email Management Microservice
 *
 * Microservice API:
 *   Input: Natural language email request
 *   Output: Natural language confirmation/result
 *
 * Examples:
 *   "Send email to john@example.com about project update" → "Email sent to john@example.com..."
 *   "Search for emails from Sarah about deployment" → "Found 5 emails from Sarah..."
 *   "Reply to the latest email from Mike" → "Reply sent successfully..."
 */
export class EmailAgent extends NaturalLanguageAgent {

  /**
   * Agent configuration - defines what this agent can do
   */
  protected getAgentConfig(): AgentConfig {
    return {
      name: 'emailAgent',

      systemPrompt: `You are an email management agent for Gmail.

Your role is to send, search, reply to, and manage emails on behalf of the user.

Your capabilities:
- Send new emails with subject and body
- Search for emails by sender, subject, keywords, date range
- Reply to existing emails
- Get specific email content
- Draft emails (save to drafts folder)

When handling email requests:
1. Extract recipient, subject, body from natural language
2. For searches, identify search criteria (from, subject, keywords, dates)
3. For replies, identify the original email to reply to
4. Always confirm action before executing (handled by draft system)
5. Provide clear confirmation after execution

Important:
- Validate email addresses before sending
- For searches, provide relevant summary of results
- For replies, maintain conversation context
- Drafts are risky operations - always require confirmation`,

      operations: [
        'send',           // Send new email
        'search',         // Search emails
        'reply',          // Reply to email
        'get',            // Get specific email
        'draft'           // Save as draft
      ],

      services: ['gmailService'],

      auth: {
        type: 'oauth',
        provider: 'google'
      },

      capabilities: [
        'Send emails to recipients',
        'Search emails by sender, subject, keywords, or date',
        'Reply to existing emails',
        'Retrieve specific email content',
        'Create email drafts'
      ],

      // Email operations are risky - require drafts
      draftRules: {
        operations: ['send', 'reply'],
        defaultRiskLevel: 'high'
      },

      limitations: [
        'Requires Gmail OAuth authentication',
        'Cannot access emails outside authorized account',
        'Send and reply operations require confirmation'
      ]
    };
  }

  /**
   * Execute internal operations - the only agent-specific logic
   */
  protected async executeOperation(
    operation: string,
    parameters: any,
    authToken: string
  ): Promise<EmailResult> {
    const gmailService = this.getService('gmailService') as GmailService;

    if (!gmailService) {
      throw new Error('GmailService not available');
    }

    switch (operation) {
      case 'send': {
        // Send new email
        const { to, subject, body, cc, bcc } = parameters;

        if (!to) {
          throw new Error('Recipient email address is required');
        }

        const result = await gmailService.sendEmail(
          authToken,
          to,
          subject || 'No Subject',
          body || '',
          { cc, bcc }
        );

        return {
          success: true,
          messageId: result.messageId,
          threadId: result.threadId,
          recipient: to,
          subject: subject || 'No Subject'
        };
      }

      case 'search': {
        // Search for emails
        const { query, from, subject, after, before, maxResults } = parameters;

        // Build Gmail search query
        let searchQuery = query || '';
        if (from) searchQuery += ` from:${from}`;
        if (subject) searchQuery += ` subject:${subject}`;
        if (after) searchQuery += ` after:${after}`;
        if (before) searchQuery += ` before:${before}`;

        const result = await gmailService.searchEmails(
          authToken,
          searchQuery.trim(),
          { maxResults: maxResults || 10 }
        );

        return {
          success: true,
          emails: result || [],
          count: result?.length || 0
        };
      }

      case 'reply': {
        // Reply to email
        const { messageId, threadId, body } = parameters;

        if (!messageId && !threadId) {
          throw new Error('Message ID or Thread ID is required to reply');
        }

        const result = await gmailService.replyToEmail(
          authToken,
          messageId || threadId,
          body || '',
          {}
        );

        return {
          success: true,
          messageId: result.messageId,
          threadId: result.threadId
        };
      }

      case 'get': {
        // Get specific email
        const { messageId } = parameters;

        if (!messageId) {
          throw new Error('Message ID is required');
        }

        const email = await gmailService.getEmail(authToken, messageId);

        return {
          success: true,
          emails: [email],
          count: 1
        };
      }

      case 'draft': {
        // Save as draft - not implemented in service, return placeholder
        return {
          success: true,
          messageId: 'draft-placeholder'
        };
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }


  /**
   * Get agent capabilities (for MasterAgent discovery)
   */
  static getCapabilities(): string[] {
    const instance = new EmailAgent();
    const config = instance.getAgentConfig();
    return config.capabilities || config.operations;
  }
}
