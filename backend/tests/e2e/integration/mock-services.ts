/**
 * Mock Services for E2E Testing
 *
 * Provides mock implementations of domain services that return data
 * from GeneratedInbox instead of calling real APIs (Gmail, Calendar, etc.)
 */

import { GeneratedInbox } from '../generators/hyper-realistic-inbox';
import { EmailDomainService } from '../../../src/services/domain/email-domain.service';
import { CalendarDomainService } from '../../../src/services/domain/calendar-domain.service';
import { ContactsDomainService } from '../../../src/services/domain/contacts-domain.service';

/**
 * Mock Email Domain Service
 * Extends real service but overrides methods to return data from GeneratedInbox
 */
export class MockEmailDomainService extends EmailDomainService {
  constructor(private inbox: GeneratedInbox) {
    // Call parent with null dependencies - we won't use them
    super(null as any, null as any);
  }

  // Override initialize to skip Google API setup
  protected async onInitialize(): Promise<void> {
    // No-op: we don't need real Google API
  }

  protected async onDestroy(): Promise<void> {
    // No-op
  }

  async searchEmails(userId: string, params: any): Promise<any[]> {
    const { query, maxResults = 100 } = params;

    // Simple keyword search in subject and body
    let results = this.inbox.emails;

    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(email =>
        email.subject.toLowerCase().includes(lowerQuery) ||
        email.body.toLowerCase().includes(lowerQuery)
      );
    }

    // Return in format expected by strategies
    return results.slice(0, maxResults).map(email => ({
      id: email.id,
      threadId: email.threadId,
      from: email.from,
      to: email.to,
      subject: email.subject,
      body: email.body,
      snippet: email.body.substring(0, 200),
      date: email.sentDate,
      labelIds: this.getLabelsForEmail(email),
      hasAttachments: email.hasAttachments,
    }));
  }

  async getEmails(userId: string, params?: any): Promise<any[]> {
    // Return all emails or filter by params
    return this.searchEmails(userId, params || {});
  }

  async getEmailById(userId: string, emailId: string): Promise<any> {
    const email = this.inbox.emails.find(e => e.id === emailId);
    if (!email) {
      throw new Error(`Email not found: ${emailId}`);
    }

    return {
      id: email.id,
      threadId: email.threadId,
      from: email.from,
      to: email.to,
      subject: email.subject,
      body: email.body,
      snippet: email.body.substring(0, 200),
      date: email.sentDate,
      labelIds: this.getLabelsForEmail(email),
      hasAttachments: email.hasAttachments,
    };
  }

  async getThreadEmails(userId: string, threadId: string): Promise<any[]> {
    const threadEmails = this.inbox.emails.filter(e => e.threadId === threadId);

    return threadEmails.map(email => ({
      id: email.id,
      threadId: email.threadId,
      from: email.from,
      to: email.to,
      subject: email.subject,
      body: email.body,
      snippet: email.body.substring(0, 200),
      date: email.sentDate,
      labelIds: this.getLabelsForEmail(email),
      hasAttachments: email.hasAttachments,
    }));
  }

  /**
   * Convert ground truth labels to Gmail-style labels
   */
  private getLabelsForEmail(email: any): string[] {
    const labels: string[] = [];

    if (email.label.isUnread !== false) labels.push('UNREAD');
    if (email.label.isImportant) labels.push('IMPORTANT');
    if (email.label.isUrgent) labels.push('STARRED');
    if (email.label.category === 'spam') labels.push('SPAM');
    if (email.label.senderType === 'boss') labels.push('CATEGORY_PERSONAL');

    return labels;
  }
}

/**
 * Mock Calendar Domain Service
 * Returns empty calendar for now (can be extended)
 */
export class MockCalendarDomainService extends CalendarDomainService {
  constructor(private inbox: GeneratedInbox) {
    // Call parent with null dependencies - we won't use them
    super(null as any, null as any);
  }

  // Override initialize to skip Google API setup
  protected async onInitialize(): Promise<void> {
    // No-op: we don't need real Google API
  }

  protected async onDestroy(): Promise<void> {
    // No-op
  }

  async listEvents(userId: string, params: any): Promise<any[]> {
    // For now, return empty array
    // In future, could generate calendar events from inbox
    return [];
  }

  async getEvent(userId: string, eventId: string, calendarId?: string): Promise<any> {
    throw new Error('No events in test inbox');
  }
}

/**
 * Mock Contacts Domain Service
 */
export class MockContactsDomainService extends ContactsDomainService {
  constructor(private inbox: GeneratedInbox) {
    // Call parent with null dependencies - we won't use them
    super(null as any, null as any);
  }

  // Override initialize to skip Google API setup
  protected async onInitialize(): Promise<void> {
    // No-op: we don't need real Google API
  }

  protected async onDestroy(): Promise<void> {
    // No-op
  }

  async listContacts(userId: string, params?: any): Promise<any> {
    // Extract unique senders from inbox
    const senders = new Map();

    for (const email of this.inbox.emails) {
      if (!senders.has(email.from)) {
        senders.set(email.from, {
          resourceName: `people/${email.from}`,
          etag: `etag-${email.from}`,
          metadata: {
            sources: [{ type: 'CONTACT', id: email.from }],
            objectType: 'PERSON' as const,
          },
          names: [{
            displayName: email.label.senderName,
            givenName: email.label.senderName.split(' ')[0],
            familyName: email.label.senderName.split(' ').slice(1).join(' '),
            metadata: {
              primary: true,
              source: { type: 'CONTACT', id: email.from }
            }
          }],
          emailAddresses: [{
            value: email.from,
            type: 'work' as const,
            primary: true
          }]
        });
      }
    }

    return {
      connections: Array.from(senders.values()),
      totalItems: senders.size
    };
  }

  async getContact(userId: string, contactId: string): Promise<any> {
    const email = this.inbox.emails.find(e => e.from === contactId.replace('people/', ''));
    if (!email) {
      throw new Error(`Contact not found: ${contactId}`);
    }

    return {
      resourceName: contactId,
      etag: `etag-${email.from}`,
      metadata: {
        sources: [{ type: 'CONTACT', id: email.from }],
        objectType: 'PERSON' as const,
      },
      names: [{
        displayName: email.label.senderName,
        givenName: email.label.senderName.split(' ')[0],
        familyName: email.label.senderName.split(' ').slice(1).join(' '),
        metadata: {
          primary: true,
          source: { type: 'CONTACT', id: email.from }
        }
      }],
      emailAddresses: [{
        value: email.from,
        type: 'work' as const,
        primary: true
      }]
    };
  }
}
