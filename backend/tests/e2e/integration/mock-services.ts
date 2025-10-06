/**
 * Mock Services for E2E Testing
 *
 * Provides mock implementations of domain services that return data
 * from GeneratedInbox instead of calling real APIs (Gmail, Calendar, etc.)
 */

import { GeneratedInbox } from '../generators/hyper-realistic-inbox';
import { IEmailDomainService } from '../../../src/services/domain/interfaces/email-domain.interface';
import { ICalendarDomainService } from '../../../src/services/domain/interfaces/calendar-domain.interface';

/**
 * Mock Email Domain Service
 * Returns emails from GeneratedInbox instead of Gmail API
 */
export class MockEmailDomainService implements Partial<IEmailDomainService> {
  constructor(private inbox: GeneratedInbox) {}

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
export class MockCalendarDomainService implements Partial<ICalendarDomainService> {
  constructor(private inbox: GeneratedInbox) {}

  async getEvents(userId: string, params: any): Promise<any[]> {
    // For now, return empty array
    // In future, could generate calendar events from inbox
    return [];
  }

  async getEventById(userId: string, eventId: string): Promise<any> {
    throw new Error('No events in test inbox');
  }
}

/**
 * Mock Contacts Domain Service
 */
export class MockContactsDomainService {
  constructor(private inbox: GeneratedInbox) {}

  async getContacts(userId: string): Promise<any[]> {
    // Extract unique senders from inbox
    const senders = new Map();

    for (const email of this.inbox.emails) {
      if (!senders.has(email.from)) {
        senders.set(email.from, {
          email: email.from,
          name: email.label.senderName,
          type: email.label.senderType,
        });
      }
    }

    return Array.from(senders.values());
  }
}
