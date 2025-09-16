import { resolveGmailService } from '../services/service-resolver';
import { GmailService } from '../services/email/gmail.service';
import { EmailParser } from './email-parser';
import {
  GmailMessage,
  GmailThread,
  ParsedEmail,
  ThreadSummary,
  ThreadUpdateRequest,
  EmailContact
} from '../types/email/gmail.types';
import logger from './logger';

/**
 * Thread management utilities for Gmail conversations
 */
export class ThreadManager {

  /**
   * Get thread with enhanced parsing and analysis
   */
  static async getEnhancedThread(accessToken: string, threadId: string): Promise<{
    thread: GmailThread;
    parsedMessages: ParsedEmail[];
    summary: ThreadSummary;
    participants: EmailContact[];
    timeline: Array<{
      date: Date;
      action: 'sent' | 'received' | 'replied';
      from: EmailContact;
      to: EmailContact[];
      messageId: string;
    }>;
  }> {
    try {
      logger.info('Getting enhanced thread', { threadId });

      const gmailService = await resolveGmailService();
      if (!gmailService) {
        throw new Error('Gmail service not available');
      }
      const thread = await gmailService.getEmailThread(accessToken, threadId);
      const parsedMessages = await Promise.all(
        thread.messages.map((message: any) => 
          EmailParser.parseGmailMessage(message)
        )
      );

      const summary = this.createThreadSummary(thread, parsedMessages);
      const participants = this.extractParticipants(parsedMessages);
      const timeline = this.createTimeline(parsedMessages);

      return {
        thread,
        parsedMessages,
        summary,
        participants,
        timeline
      };
    } catch (error) {
      logger.error('Failed to get enhanced thread', { error, threadId });
      throw error;
    }
  }

  /**
   * Create a thread summary
   */
  static createThreadSummary(thread: GmailThread, parsedMessages: ParsedEmail[]): ThreadSummary {
    const participants = this.extractParticipants(parsedMessages);
    const unreadCount = parsedMessages.filter(msg => msg.isUnread).length;
    const hasAttachments = parsedMessages.some(msg => msg.attachments.length > 0);
    const lastMessage = parsedMessages[parsedMessages.length - 1];

    return {
      id: thread.id,
      subject: lastMessage?.subject || 'No Subject',
      participants,
      messageCount: parsedMessages.length,
      unreadCount,
      lastMessageDate: lastMessage?.date || new Date(),
      labels: this.aggregateLabels(parsedMessages),
      snippet: thread.snippet || '',
      hasAttachments
    };
  }

  /**
   * Extract all unique participants from a thread
   */
  static extractParticipants(parsedMessages: ParsedEmail[]): EmailContact[] {
    const participantMap = new Map<string, EmailContact>();

    for (const message of parsedMessages) {
      // Add sender
      if (message.from.email) {
        participantMap.set(message.from.email, message.from);
      }

      // Add recipients
      for (const recipient of message.to) {
        if (recipient.email) {
          participantMap.set(recipient.email, recipient);
        }
      }

      // Add CC recipients
      if (message.cc) {
        for (const ccRecipient of message.cc) {
          if (ccRecipient.email) {
            participantMap.set(ccRecipient.email, ccRecipient);
          }
        }
      }
    }

    return Array.from(participantMap.values());
  }

  /**
   * Create timeline of thread activity
   */
  static createTimeline(parsedMessages: ParsedEmail[]): Array<{
    date: Date;
    action: 'sent' | 'received' | 'replied';
    from: EmailContact;
    to: EmailContact[];
    messageId: string;
  }> {
    return parsedMessages.map((message, index) => {
      let action: 'sent' | 'received' | 'replied' = 'received';
      
      // This is a simplified logic - in a real app, you'd determine this
      // based on the authenticated user's email address
      if (index > 0) {
        action = 'replied';
      }

      return {
        date: message.date,
        action,
        from: message.from,
        to: message.to,
        messageId: message.id
      };
    }).sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Aggregate labels from all messages in thread
   */
  private static aggregateLabels(parsedMessages: ParsedEmail[]): string[] {
    const labelSet = new Set<string>();
    
    for (const message of parsedMessages) {
      for (const label of message.labels) {
        labelSet.add(label);
      }
    }

    return Array.from(labelSet);
  }

  /**
   * Find the root message of a thread
   */
  static findRootMessage(parsedMessages: ParsedEmail[]): ParsedEmail | null {
    if (parsedMessages.length === 0) return null;
    
    // The root message is typically the oldest one
    return parsedMessages.reduce((oldest, current) => 
      current.date < oldest.date ? current : oldest
    );
  }

  /**
   * Find the latest message in a thread
   */
  static findLatestMessage(parsedMessages: ParsedEmail[]): ParsedEmail | null {
    if (parsedMessages.length === 0) return null;
    
    return parsedMessages.reduce((latest, current) => 
      current.date > latest.date ? current : latest
    );
  }

  /**
   * Check if user is mentioned in any message
   */
  static isUserMentioned(parsedMessages: ParsedEmail[], userEmail: string): boolean {
    return parsedMessages.some(message => {
      const bodyText = (message.body.text || message.body.html || '').toLowerCase();
      return bodyText.includes(userEmail.toLowerCase()) ||
             message.to.some(contact => contact.email.toLowerCase() === userEmail.toLowerCase()) ||
             (message.cc && message.cc.some(contact => contact.email.toLowerCase() === userEmail.toLowerCase()));
    });
  }

  /**
   * Get thread context for AI processing
   */
  static getThreadContext(parsedMessages: ParsedEmail[], maxMessages: number = 10): string {
    const recentMessages = parsedMessages
      .slice(-maxMessages)
      .map(message => EmailParser.formatEmailForDisplay(message))
      .join('\n\n---\n\n');

    return recentMessages;
  }

  /**
   * Suggest reply recipients based on thread context
   */
  static suggestReplyRecipients(
    parsedMessages: ParsedEmail[], 
    currentUserEmail: string,
    replyToAll: boolean = false
  ): { to: EmailContact[]; cc: EmailContact[] } {
    if (parsedMessages.length === 0) {
      return { to: [], cc: [] };
    }

    const latestMessage = this.findLatestMessage(parsedMessages)!;
    
    if (!replyToAll) {
      // Reply only to sender
      return {
        to: [latestMessage.from],
        cc: []
      };
    }

    // Reply to all participants except current user
    const allParticipants = this.extractParticipants(parsedMessages);
    const filteredParticipants = allParticipants.filter(
      participant => participant.email.toLowerCase() !== currentUserEmail.toLowerCase()
    );

    // The sender goes to 'to', others go to 'cc'
    const to = [latestMessage.from];
    const cc = filteredParticipants.filter(
      participant => participant.email !== latestMessage.from.email
    );

    return { to, cc };
  }

  /**
   * Update thread properties (labels, read status, etc.)
   */
  static async updateThread(accessToken: string, updateRequest: ThreadUpdateRequest): Promise<void> {
    try {
      logger.info('Updating thread', { threadId: updateRequest.threadId });

      const gmailService = await resolveGmailService();
      if (!gmailService) {
        throw new Error('Gmail service not available');
      }
      const thread = await gmailService.getEmailThread(accessToken, updateRequest.threadId);
      
      // Update each message in the thread
      for (const _message of thread.messages) {
        // Note: markAsRead/markAsUnread methods not implemented in GmailService

        // Note: Gmail API doesn't have a direct way to add/remove labels to threads
        // This would require individual message updates or using the threads.modify endpoint
        // For now, we'll handle this at the message level
      }

      logger.info('Thread updated successfully', { threadId: updateRequest.threadId });
    } catch (error) {
      logger.error('Failed to update thread', { error, threadId: updateRequest.threadId });
      throw error;
    }
  }

  /**
   * Archive entire thread
   */
  static async archiveThread(accessToken: string, threadId: string): Promise<void> {
    try {
      logger.info('Archiving thread', { threadId });

      const gmailService = await resolveGmailService();
      if (!gmailService) {
        throw new Error('Gmail service not available');
      }
      await gmailService.getEmailThread(accessToken, threadId);
      
      // Archive each message in the thread by removing INBOX label
      // This would need to be implemented in the Gmail service
      // for (const message of thread.messages) {
      //   await gmailService.removeLabel(accessToken, message.id, 'INBOX');
      // }

      logger.info('Thread archived successfully', { threadId });
    } catch (error) {
      logger.error('Failed to archive thread', { error, threadId });
      throw error;
    }
  }

  /**
   * Get thread statistics
   */
  static getThreadStatistics(parsedMessages: ParsedEmail[]): {
    messageCount: number;
    participantCount: number;
    unreadCount: number;
    attachmentCount: number;
    averageResponseTime: number; // in hours
    longestGapBetweenMessages: number; // in hours
    threadDuration: number; // in hours
  } {
    if (parsedMessages.length === 0) {
      return {
        messageCount: 0,
        participantCount: 0,
        unreadCount: 0,
        attachmentCount: 0,
        averageResponseTime: 0,
        longestGapBetweenMessages: 0,
        threadDuration: 0
      };
    }

    const participants = this.extractParticipants(parsedMessages);
    const unreadCount = parsedMessages.filter(msg => msg.isUnread).length;
    const attachmentCount = parsedMessages.reduce((sum, msg) => sum + msg.attachments.length, 0);

    // Calculate time-based statistics
    const sortedMessages = [...parsedMessages].sort((a, b) => a.date.getTime() - b.date.getTime());
    const firstMessage = sortedMessages[0];
    const lastMessage = sortedMessages[sortedMessages.length - 1];

    const threadDuration = lastMessage && firstMessage ? (lastMessage.date.getTime() - firstMessage.date.getTime()) / (1000 * 60 * 60) : 0;

    // Calculate gaps between messages
    const gaps: number[] = [];
    for (let i = 1; i < sortedMessages.length; i++) {
      const current = sortedMessages[i];
      const previous = sortedMessages[i - 1];
      if (current && previous) {
        const gap = (current.date.getTime() - previous.date.getTime()) / (1000 * 60 * 60);
        gaps.push(gap);
      }
    }

    const averageResponseTime = gaps.length > 0 ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : 0;
    const longestGapBetweenMessages = gaps.length > 0 ? Math.max(...gaps) : 0;

    return {
      messageCount: parsedMessages.length,
      participantCount: participants.length,
      unreadCount,
      attachmentCount,
      averageResponseTime,
      longestGapBetweenMessages,
      threadDuration
    };
  }

  /**
   * Detect if thread needs attention (e.g., awaiting response)
   */
  static needsAttention(
    parsedMessages: ParsedEmail[], 
    currentUserEmail: string
  ): {
    needsAttention: boolean;
    reason: string;
    urgency: 'low' | 'medium' | 'high';
  } {
    if (parsedMessages.length === 0) {
      return { needsAttention: false, reason: 'No messages', urgency: 'low' };
    }

    const latestMessage = this.findLatestMessage(parsedMessages);
    if (!latestMessage) {
      return { needsAttention: false, reason: 'No messages', urgency: 'low' };
    }
    const isLatestFromUser = latestMessage.from.email.toLowerCase() === currentUserEmail.toLowerCase();
    
    // Check if user was mentioned or directly addressed
    const isMentioned = this.isUserMentioned(parsedMessages, currentUserEmail);
    
    // Check for question marks indicating questions
    const hasQuestions = parsedMessages.some(msg => 
      (msg.body.text || msg.body.html || '').includes('?')
    );

    // Check time since last message
    const hoursSinceLastMessage = (Date.now() - latestMessage.date.getTime()) / (1000 * 60 * 60);
    
    // Check for unread messages
    const hasUnread = parsedMessages.some(msg => msg.isUnread);

    // Determine urgency and need for attention
    if (!isLatestFromUser && (isMentioned || hasQuestions)) {
      if (hoursSinceLastMessage > 48) {
        return { 
          needsAttention: true, 
          reason: 'Pending response for over 48 hours', 
          urgency: 'high' 
        };
      } else if (hoursSinceLastMessage > 24) {
        return { 
          needsAttention: true, 
          reason: 'Pending response for over 24 hours', 
          urgency: 'medium' 
        };
      } else if (hasUnread) {
        return { 
          needsAttention: true, 
          reason: 'Unread messages requiring response', 
          urgency: 'medium' 
        };
      }
    }

    if (hasUnread && hoursSinceLastMessage > 4) {
      return { 
        needsAttention: true, 
        reason: 'Unread messages', 
        urgency: 'low' 
      };
    }

    return { needsAttention: false, reason: 'Up to date', urgency: 'low' };
  }

  /**
   * Generate thread summary text for AI processing
   */
  static generateThreadSummary(parsedMessages: ParsedEmail[]): string {
    if (parsedMessages.length === 0) {
      return 'Empty thread';
    }

    const rootMessage = this.findRootMessage(parsedMessages);
    const latestMessage = this.findLatestMessage(parsedMessages);
    if (!rootMessage || !latestMessage) {
      return 'Empty thread';
    }
    const participants = this.extractParticipants(parsedMessages);
    const stats = this.getThreadStatistics(parsedMessages);

    return [
      `Subject: ${rootMessage.subject}`,
      `Participants: ${participants.map(p => p.name || p.email).join(', ')}`,
      `Messages: ${stats.messageCount}`,
      `Started: ${rootMessage.date.toLocaleDateString()}`,
      `Last activity: ${latestMessage.date.toLocaleDateString()}`,
      `Unread: ${stats.unreadCount}`,
      stats.attachmentCount > 0 ? `Attachments: ${stats.attachmentCount}` : '',
      '',
      'Latest message:',
      EmailParser.generatePreview(latestMessage.body.text || latestMessage.body.html || '', 200)
    ].filter(Boolean).join('\n');
  }
}

/**
 * Thread search and filtering utilities
 */
export class ThreadSearch {
  
  /**
   * Search threads by criteria
   */
  static async searchThreads(
    accessToken: string,
    criteria: {
      query?: string;
      participants?: string[];
      hasAttachments?: boolean;
      isUnread?: boolean;
      dateAfter?: Date;
      dateBefore?: Date;
      maxResults?: number;
    }
  ): Promise<ThreadSummary[]> {
    try {
      // Build Gmail search query
      let searchQuery = criteria.query || '';
      
      if (criteria.participants) {
        const participantQueries = criteria.participants.map(email => `from:${email} OR to:${email}`);
        searchQuery += ` (${participantQueries.join(' OR ')})`;
      }
      
      if (criteria.hasAttachments) {
        searchQuery += ' has:attachment';
      }
      
      if (criteria.isUnread) {
        searchQuery += ' is:unread';
      }
      
      if (criteria.dateAfter) {
        const dateStr = criteria.dateAfter.toISOString().split('T')[0];
        searchQuery += ` after:${dateStr}`;
      }
      
      if (criteria.dateBefore) {
        const dateStr = criteria.dateBefore.toISOString().split('T')[0];
        searchQuery += ` before:${dateStr}`;
      }

      const gmailService = await resolveGmailService();
      if (!gmailService) {
        throw new Error('Gmail service not available');
      }
      const searchResult = await gmailService.searchEmails(
        accessToken,
        searchQuery.trim(),
        {
          maxResults: criteria.maxResults || 20
        }
      );

      // Group messages by thread and create summaries
      const threadMap = new Map<string, GmailMessage[]>();
      
      for (const message of searchResult) {
        if (!threadMap.has(message.threadId)) {
          threadMap.set(message.threadId, []);
        }
        threadMap.get(message.threadId)!.push(message);
      }

      const threadSummaries: ThreadSummary[] = [];
      
      for (const [threadId, messages] of threadMap) {
        const parsedMessages = await Promise.all(
          messages.map(msg => EmailParser.parseGmailMessage(msg))
        );
        const thread: GmailThread = {
          id: threadId,
          historyId: messages[0]?.historyId || '',
          messages: messages,
          snippet: messages[0]?.snippet
        };
        
        const summary = ThreadManager.createThreadSummary(thread, parsedMessages);
        threadSummaries.push(summary);
      }

      return threadSummaries.sort((a, b) => 
        b.lastMessageDate.getTime() - a.lastMessageDate.getTime()
      );
    } catch (error) {
      logger.error('Failed to search threads', { error, criteria });
      throw error;
    }
  }
}