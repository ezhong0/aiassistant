/**
 * Whole Inbox Generator for E2E Testing
 * 
 * Generates complete, realistic inbox environments for comprehensive testing.
 * Uses AI to create realistic email patterns, relationships, and user-specific characteristics.
 */

import { GenericAIService } from '../../services/generic-ai.service';
import { BaseService } from '../../services/base-service';

// Core interfaces for inbox generation
export interface UserProfile {
  role: 'executive' | 'manager' | 'individual' | 'mixed';
  industry: string;
  communicationStyle: 'formal' | 'casual' | 'mixed';
  urgencyLevel: 'high' | 'medium' | 'low';
  emailVolume: 'high' | 'medium' | 'low';
  preferences: UserPreferences;
  timezone: string;
  workingHours: {
    start: string;
    end: string;
  };
}

export interface UserPreferences {
  responseTime: 'immediate' | 'within_hour' | 'within_day' | 'within_week';
  priorityLevel: 'high' | 'medium' | 'low';
  followUpRequired: boolean;
  meetingPreferences: string[];
  communicationChannels: string[];
}

export interface EmailPattern {
  type: 'urgent' | 'meeting' | 'follow-up' | 'newsletter' | 'notification' | 'project' | 'social';
  frequency: number; // 0-1, percentage of total emails
  characteristics: EmailCharacteristics;
  templates: EmailTemplate[];
}

export interface EmailCharacteristics {
  responseTime: 'immediate' | 'within_hour' | 'within_day' | 'within_week';
  priority: 'high' | 'medium' | 'low';
  followUpRequired: boolean;
  threadLength: 'short' | 'medium' | 'long';
  complexity: 'simple' | 'moderate' | 'complex';
}

export interface EmailTemplate {
  subjectPattern: string;
  senderPattern: string;
  contentPattern: string;
  metadata: EmailMetadata;
}

export interface EmailMetadata {
  labels: string[];
  readStatus: 'read' | 'unread';
  importance: 'high' | 'normal' | 'low';
  threadId?: string;
  replyTo?: string;
}

export interface InboxTemplate {
  userProfile: UserProfile;
  emailCount: number;
  timeRange: {
    start: string;
    end: string;
  };
  emailPatterns: EmailPattern[];
  relationships: EmailRelationship[];
  categories: EmailCategory[];
}

export interface EmailRelationship {
  type: 'thread' | 'reply' | 'forward' | 'reference';
  emailIds: string[];
  relationshipStrength: 'strong' | 'medium' | 'weak';
}

export interface EmailCategory {
  name: string;
  pattern: string;
  emails: string[];
}

export interface Email {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  sizeEstimate: number;
  historyId: string;
  internalDate: string;
  payload: {
    mimeType: string;
    headers: Array<{
      name: string;
      value: string;
    }>;
    body?: {
      data: string;
      size: number;
    };
    parts?: Array<{
      mimeType: string;
      headers: Array<{
        name: string;
        value: string;
      }>;
      body: {
        data: string;
        size: number;
        attachmentId?: string;
      };
      filename?: string;
    }>;
  };
  // Additional metadata for our internal use
  metadata: {
    urgency: 'low' | 'medium' | 'high';
    category: string;
    readStatus: 'read' | 'unread';
    importance: 'high' | 'normal' | 'low';
    sender: {
      name: string;
      email: string;
      company?: string;
      role?: string;
    };
    recipients: {
      to: string[];
      cc?: string[];
      bcc?: string[];
    };
    content: {
      body: string;
      summary: string;
      attachments?: string[];
    };
  };
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  attendees: string[];
  location?: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  relatedEmails: string[];
}

export interface InboxData {
  emails: Email[];
  relationships: EmailRelationship[];
  calendar: CalendarEvent[];
  metadata: {
    totalEmails: number;
    timeRange: { start: string; end: string };
    userProfile: UserProfile;
    generatedAt: string;
  };
}

/**
 * Main inbox generator class
 */
export class WholeInboxGenerator extends BaseService {
  private aiService: GenericAIService;
  private templates: Map<string, InboxTemplate> = new Map();

  constructor(aiService: GenericAIService) {
    super('WholeInboxGenerator');
    this.aiService = aiService;
  }

  /**
   * Service initialization
   */
  protected async onInitialize(): Promise<void> {
    this.logInfo('WholeInboxGenerator initialized');
    await this.loadTemplates();
  }

  /**
   * Load predefined inbox templates
   */
  private async loadTemplates(): Promise<void> {
    const templates = [
      this.getExecutiveTemplate(),
      this.getManagerTemplate(),
      this.getIndividualTemplate(),
      this.getMixedRoleTemplate()
    ];

    templates.forEach(template => {
      this.templates.set(template.userProfile.role, template);
    });

    this.logInfo(`Loaded ${templates.length} inbox templates`);
  }

  /**
   * Generate a complete inbox based on template
   */
  async generateCompleteInbox(template: InboxTemplate): Promise<InboxData> {
    this.logInfo(`Generating inbox for ${template.userProfile.role} with ${template.emailCount} emails`);

    try {
      // Step 1: Generate email set
      const emails = await this.generateEmailSet(template);
      
      // Step 2: Generate relationships
      const relationships = await this.generateRelationships(emails, template);
      
      // Step 3: Generate calendar events
      const calendar = await this.generateCalendarData(template, emails);
      
      // Step 4: Create final inbox data
      const inboxData: InboxData = {
        emails,
        relationships,
        calendar,
        metadata: {
          totalEmails: emails.length,
          timeRange: template.timeRange,
          userProfile: template.userProfile,
          generatedAt: new Date().toISOString()
        }
      };

      this.logInfo(`Generated inbox with ${emails.length} emails, ${relationships.length} relationships, ${calendar.length} calendar events`);
      return inboxData;

    } catch (error) {
      this.logError('Failed to generate complete inbox', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate email set based on patterns
   */
  private async generateEmailSet(template: InboxTemplate): Promise<Email[]> {
    const emails: Email[] = [];
    const startDate = new Date(template.timeRange.start);
    const endDate = new Date(template.timeRange.end);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Generate emails for each pattern
    for (const pattern of template.emailPatterns) {
      const patternCount = Math.floor(template.emailCount * pattern.frequency);
      const patternEmails = await this.generateEmailsForPattern(pattern, patternCount, startDate, endDate, template.userProfile);
      emails.push(...patternEmails);
    }

    // Sort emails by timestamp
    emails.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return emails;
  }

  /**
   * Generate emails for a specific pattern
   */
  private async generateEmailsForPattern(
    pattern: EmailPattern,
    count: number,
    startDate: Date,
    endDate: Date,
    userProfile: UserProfile
  ): Promise<Email[]> {
    const prompt = `
    Generate ${count} realistic ${pattern.type} emails for a ${userProfile.role} in the ${userProfile.industry} industry.
    
    User Profile:
    - Role: ${userProfile.role}
    - Industry: ${userProfile.industry}
    - Communication Style: ${userProfile.communicationStyle}
    - Urgency Level: ${userProfile.urgencyLevel}
    - Email Volume: ${userProfile.emailVolume}
    
    Email Pattern:
    - Type: ${pattern.type}
    - Response Time: ${pattern.characteristics.responseTime}
    - Priority: ${pattern.characteristics.priority}
    - Follow-up Required: ${pattern.characteristics.followUpRequired}
    - Thread Length: ${pattern.characteristics.threadLength}
    - Complexity: ${pattern.characteristics.complexity}
    
    Time Range: ${startDate.toISOString()} to ${endDate.toISOString()}
    
    Generate realistic emails with:
    - Realistic subject lines
    - Realistic sender names and companies
    - Realistic email content
    - Appropriate timestamps within the time range
    - Realistic email metadata (read status, labels, importance)
    - Proper urgency levels
    - Realistic email categories
    
    Return as JSON array with this structure:
    [
      {
        "subject": "realistic subject",
        "sender": {
          "name": "Sender Name",
          "email": "sender@company.com",
          "company": "Company Name",
          "role": "Sender Role"
        },
        "recipients": {
          "to": ["recipient@company.com"],
          "cc": ["cc@company.com"],
          "bcc": []
        },
        "content": {
          "body": "realistic email content",
          "summary": "brief summary",
          "attachments": []
        },
        "metadata": {
          "urgency": "high",
          "category": "urgent",
          "readStatus": "unread",
          "importance": "high"
        }
      }
    ]
    `;

    try {
      const response = await this.aiService.generateResponse(prompt);
      const emailData = JSON.parse(response);
      
      // Convert to Gmail API format
      return emailData.map((email: any, index: number) => {
        const timestamp = this.generateRealisticTimestamp(startDate, endDate, pattern.characteristics.responseTime);
        const date = new Date(timestamp);
        const rfc2822Date = this.formatDateToRFC2822(date);
        
        return this.createGmailFormatEmail(email, index, pattern.type, rfc2822Date);
      });

    } catch (error) {
      this.logError(`Failed to generate emails for pattern ${pattern.type}`, { error: error.message });
      return [];
    }
  }

  /**
   * Create email in Gmail API format
   */
  private createGmailFormatEmail(emailData: any, index: number, patternType: string, rfc2822Date: string): Email {
    const id = this.generateMessageId();
    const threadId = this.generateThreadId();
    const historyId = this.generateHistoryId();
    const internalDate = Date.now().toString();
    
    // Determine labels based on pattern and metadata
    const labels = this.determineLabels(emailData.metadata, patternType);
    
    // Create headers in Gmail format
    const headers = [
      { name: 'Message-ID', value: `<${id}@gmail.com>` },
      { name: 'Date', value: rfc2822Date },
      { name: 'From', value: `${emailData.sender.name} <${emailData.sender.email}>` },
      { name: 'To', value: emailData.recipients.to.join(', ') },
      { name: 'Subject', value: emailData.subject }
    ];
    
    // Add CC if present
    if (emailData.recipients.cc && emailData.recipients.cc.length > 0) {
      headers.push({ name: 'Cc', value: emailData.recipients.cc.join(', ') });
    }
    
    // Add BCC if present
    if (emailData.recipients.bcc && emailData.recipients.bcc.length > 0) {
      headers.push({ name: 'Bcc', value: emailData.recipients.bcc.join(', ') });
    }
    
    // Add Reply-To if present
    if (emailData.sender.email) {
      headers.push({ name: 'Reply-To', value: emailData.sender.email });
    }
    
    // Create MIME body parts with proper encoding
    const plainTextBody = Buffer.from(emailData.content.body, 'utf8').toString('base64');
    const htmlBody = Buffer.from(this.convertToHtml(emailData.content.body), 'utf8').toString('base64');
    
    const parts = [
      {
        mimeType: 'text/plain',
        headers: [
          { name: 'Content-Type', value: 'text/plain; charset=UTF-8' },
          { name: 'Content-Transfer-Encoding', value: 'base64' },
          { name: 'Content-Disposition', value: 'inline' }
        ],
        body: {
          data: plainTextBody,
          size: Buffer.from(emailData.content.body, 'utf8').length
        }
      },
      {
        mimeType: 'text/html',
        headers: [
          { name: 'Content-Type', value: 'text/html; charset=UTF-8' },
          { name: 'Content-Transfer-Encoding', value: 'base64' },
          { name: 'Content-Disposition', value: 'inline' }
        ],
        body: {
          data: htmlBody,
          size: Buffer.from(this.convertToHtml(emailData.content.body), 'utf8').length
        }
      }
    ];

    // Add attachments if present
    if (emailData.content.attachments && emailData.content.attachments.length > 0) {
      for (const attachment of emailData.content.attachments) {
        const attachmentId = this.generateAttachmentId();
        const attachmentData = Buffer.from(attachment, 'utf8').toString('base64');
        
        parts.push({
          mimeType: 'application/octet-stream',
          headers: [
            { name: 'Content-Type', value: 'application/octet-stream' },
            { name: 'Content-Transfer-Encoding', value: 'base64' },
            { name: 'Content-Disposition', value: `attachment; filename="${attachmentId}.txt"` }
          ],
          body: {
            data: attachmentData,
            size: Buffer.from(attachment, 'utf8').length,
            attachmentId
          },
          filename: `${attachmentId}.txt`
        });
      }
    }
    
    const totalSize = plainTextBody.length + htmlBody.length;
    
    return {
      id,
      threadId,
      labelIds: labels,
      snippet: emailData.content.summary.substring(0, 100), // Gmail snippet is typically ~100 chars
      sizeEstimate: totalSize,
      historyId,
      internalDate,
      payload: {
        mimeType: 'multipart/alternative',
        headers,
        parts
      },
      metadata: {
        urgency: emailData.metadata.urgency,
        category: emailData.metadata.category,
        readStatus: emailData.metadata.readStatus,
        importance: emailData.metadata.importance,
        sender: emailData.sender,
        recipients: emailData.recipients,
        content: emailData.content
      }
    };
  }

  /**
   * Determine Gmail labels based on metadata and pattern
   */
  private determineLabels(metadata: any, patternType: string): string[] {
    const labels = ['INBOX'];
    
    // Add pattern-specific labels
    switch (patternType) {
      case 'urgent':
        labels.push('IMPORTANT');
        break;
      case 'meeting':
        labels.push('CATEGORY_PERSONAL');
        break;
      case 'newsletter':
        labels.push('CATEGORY_PROMOTIONS');
        break;
      case 'project':
        labels.push('CATEGORY_UPDATES');
        break;
    }
    
    // Add importance labels
    if (metadata.importance === 'high') {
      labels.push('IMPORTANT');
    }
    
    // Add read status
    if (metadata.readStatus === 'read') {
      labels.push('READ');
    } else {
      labels.push('UNREAD');
    }
    
    return labels;
  }

  /**
   * Convert plain text to basic HTML
   */
  private convertToHtml(plainText: string): string {
    return plainText
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  }

  /**
   * Format date to RFC 2822 format (Gmail standard)
   */
  private formatDateToRFC2822(date: Date): string {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const dayName = days[date.getUTCDay()];
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');
    
    return `${dayName}, ${day} ${month} ${year} ${hours}:${minutes}:${seconds} +0000`;
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique thread ID
   */
  private generateThreadId(): string {
    return `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique attachment ID
   */
  private generateAttachmentId(): string {
    return `attachment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate realistic timestamp based on pattern characteristics
   */
  private generateRealisticTimestamp(startDate: Date, endDate: Date, responseTime: string): string {
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    const randomTime = startTime + Math.random() * (endTime - startTime);
    
    const date = new Date(randomTime);
    
    // Adjust based on response time requirements
    switch (responseTime) {
      case 'immediate':
        // Recent emails (last 7 days)
        date.setTime(date.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
        break;
      case 'within_hour':
        // Recent emails (last 30 days)
        date.setTime(date.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);
        break;
      case 'within_day':
        // Recent emails (last 90 days)
        date.setTime(date.getTime() - Math.random() * 90 * 24 * 60 * 60 * 1000);
        break;
      case 'within_week':
        // Older emails (up to 1 year)
        date.setTime(date.getTime() - Math.random() * 365 * 24 * 60 * 60 * 1000);
        break;
    }
    
    return date.toISOString();
  }

  /**
   * Generate email relationships with proper threading
   */
  private async generateRelationships(emails: Email[], template: InboxTemplate): Promise<EmailRelationship[]> {
    const relationships: EmailRelationship[] = [];
    
    // Group emails by potential thread patterns
    const threadGroups = this.groupEmailsForThreading(emails);
    
    for (const group of threadGroups) {
      if (group.length > 1) {
        // Sort emails by timestamp to establish proper thread order
        group.sort((a, b) => {
          const dateA = this.getDateFromHeaders(a.payload.headers);
          const dateB = this.getDateFromHeaders(b.payload.headers);
          return dateA.getTime() - dateB.getTime();
        });
        
        // Update emails with proper threading headers
        for (let i = 1; i < group.length; i++) {
          const currentEmail = group[i];
          const previousEmail = group[i - 1];
          
          // Add threading headers
          const messageIdHeader = previousEmail.payload.headers.find(h => h.name === 'Message-ID');
          if (messageIdHeader) {
            // Add In-Reply-To header
            currentEmail.payload.headers.push({
              name: 'In-Reply-To',
              value: messageIdHeader.value
            });
            
            // Add References header (accumulate all previous Message-IDs)
            const references = group.slice(0, i).map(email => {
              const msgId = email.payload.headers.find(h => h.name === 'Message-ID');
              return msgId ? msgId.value : '';
            }).filter(ref => ref);
            
            if (references.length > 0) {
              currentEmail.payload.headers.push({
                name: 'References',
                value: references.join(' ')
              });
            }
          }
        }
        
        relationships.push({
          type: 'thread',
          emailIds: group.map(email => email.id),
          relationshipStrength: 'strong'
        });
      }
    }
    
    return relationships;
  }

  /**
   * Get date from email headers
   */
  private getDateFromHeaders(headers: Array<{ name: string; value: string }>): Date {
    const dateHeader = headers.find(h => h.name === 'Date');
    if (dateHeader) {
      return new Date(dateHeader.value);
    }
    return new Date();
  }

  /**
   * Group emails for threading based on patterns
   */
  private groupEmailsForThreading(emails: Email[]): Email[][] {
    const groups: Email[][] = [];
    const processed = new Set<string>();
    
    for (const email of emails) {
      if (processed.has(email.id)) continue;
      
      const group = [email];
      processed.add(email.id);
      
      // Find related emails (same subject pattern, similar senders, etc.)
      for (const otherEmail of emails) {
        if (processed.has(otherEmail.id)) continue;
        
        if (this.areEmailsRelated(email, otherEmail)) {
          group.push(otherEmail);
          processed.add(otherEmail.id);
        }
      }
      
      groups.push(group);
    }
    
    return groups;
  }

  /**
   * Check if two emails are related
   */
  private areEmailsRelated(email1: Email, email2: Email): boolean {
    // Same sender
    if (email1.sender.email === email2.sender.email) return true;
    
    // Similar subject (basic pattern matching)
    const subject1 = email1.subject.toLowerCase();
    const subject2 = email2.subject.toLowerCase();
    
    if (subject1.includes('re:') && subject2.includes('re:')) {
      const baseSubject1 = subject1.replace(/^re:\s*/, '');
      const baseSubject2 = subject2.replace(/^re:\s*/, '');
      if (baseSubject1 === baseSubject2) return true;
    }
    
    // Same company
    if (email1.sender.company === email2.sender.company) return true;
    
    return false;
  }

  /**
   * Generate calendar events related to emails
   */
  private async generateCalendarData(template: InboxTemplate, emails: Email[]): Promise<CalendarEvent[]> {
    const calendarEvents: CalendarEvent[] = [];
    
    // Find emails that mention meetings or events
    const meetingEmails = emails.filter(email => 
      email.subject.toLowerCase().includes('meeting') ||
      email.subject.toLowerCase().includes('call') ||
      email.subject.toLowerCase().includes('event') ||
      email.content.body.toLowerCase().includes('meeting')
    );
    
    for (const email of meetingEmails.slice(0, 20)) { // Limit to 20 events
      const event = await this.generateCalendarEventFromEmail(email, template.userProfile);
      if (event) {
        calendarEvents.push(event);
      }
    }
    
    return calendarEvents;
  }

  /**
   * Generate calendar event from email
   */
  private async generateCalendarEventFromEmail(email: Email, userProfile: UserProfile): Promise<CalendarEvent | null> {
    const prompt = `
    Generate a realistic calendar event based on this email:
    
    Email Subject: ${email.subject}
    Email Content: ${email.content.body}
    Sender: ${email.sender.name} (${email.sender.email})
    User Profile: ${userProfile.role} in ${userProfile.industry}
    
    Generate a calendar event with:
    - Realistic title
    - Realistic description
    - Realistic start/end times
    - Realistic attendees
    - Realistic location (if applicable)
    - Realistic status
    
    Return as JSON:
    {
      "id": "event_id",
      "title": "Meeting Title",
      "description": "Meeting description",
      "start": "2024-01-15T10:00:00Z",
      "end": "2024-01-15T11:00:00Z",
      "attendees": ["attendee1@company.com", "attendee2@company.com"],
      "location": "Conference Room A",
      "status": "confirmed",
      "relatedEmails": ["${email.id}"]
    }
    `;

    try {
      const response = await this.aiService.generateResponse(prompt);
      const event = JSON.parse(response);
      
      return {
        ...event,
        id: event.id || `event_${email.id}`,
        relatedEmails: [email.id]
      };

    } catch (error) {
      this.logError('Failed to generate calendar event from email', { error: error.message });
      return null;
    }
  }

  /**
   * Get predefined templates
   */
  getExecutiveTemplate(): InboxTemplate {
    return {
      userProfile: {
        role: 'executive',
        industry: 'technology',
        communicationStyle: 'formal',
        urgencyLevel: 'high',
        emailVolume: 'high',
        preferences: {
          responseTime: 'within_hour',
          priorityLevel: 'high',
          followUpRequired: true,
          meetingPreferences: ['morning', 'afternoon'],
          communicationChannels: ['email', 'calendar']
        },
        timezone: 'America/New_York',
        workingHours: { start: '08:00', end: '18:00' }
      },
      emailCount: 500,
      timeRange: {
        start: '2024-01-01T00:00:00Z',
        end: '2024-12-31T23:59:59Z'
      },
      emailPatterns: [
        {
          type: 'urgent',
          frequency: 0.3,
          characteristics: {
            responseTime: 'immediate',
            priority: 'high',
            followUpRequired: true,
            threadLength: 'short',
            complexity: 'moderate'
          },
          templates: []
        },
        {
          type: 'meeting',
          frequency: 0.4,
          characteristics: {
            responseTime: 'within_hour',
            priority: 'high',
            followUpRequired: false,
            threadLength: 'medium',
            complexity: 'simple'
          },
          templates: []
        },
        {
          type: 'project',
          frequency: 0.2,
          characteristics: {
            responseTime: 'within_day',
            priority: 'medium',
            followUpRequired: true,
            threadLength: 'long',
            complexity: 'complex'
          },
          templates: []
        },
        {
          type: 'newsletter',
          frequency: 0.1,
          characteristics: {
            responseTime: 'within_week',
            priority: 'low',
            followUpRequired: false,
            threadLength: 'short',
            complexity: 'simple'
          },
          templates: []
        }
      ],
      relationships: [],
      categories: []
    };
  }

  getManagerTemplate(): InboxTemplate {
    return {
      userProfile: {
        role: 'manager',
        industry: 'technology',
        communicationStyle: 'mixed',
        urgencyLevel: 'medium',
        emailVolume: 'medium',
        preferences: {
          responseTime: 'within_day',
          priorityLevel: 'medium',
          followUpRequired: true,
          meetingPreferences: ['morning', 'afternoon'],
          communicationChannels: ['email', 'calendar', 'slack']
        },
        timezone: 'America/New_York',
        workingHours: { start: '09:00', end: '17:00' }
      },
      emailCount: 300,
      timeRange: {
        start: '2024-01-01T00:00:00Z',
        end: '2024-12-31T23:59:59Z'
      },
      emailPatterns: [
        {
          type: 'urgent',
          frequency: 0.2,
          characteristics: {
            responseTime: 'within_hour',
            priority: 'high',
            followUpRequired: true,
            threadLength: 'short',
            complexity: 'moderate'
          },
          templates: []
        },
        {
          type: 'follow-up',
          frequency: 0.3,
          characteristics: {
            responseTime: 'within_day',
            priority: 'medium',
            followUpRequired: true,
            threadLength: 'medium',
            complexity: 'moderate'
          },
          templates: []
        },
        {
          type: 'meeting',
          frequency: 0.3,
          characteristics: {
            responseTime: 'within_day',
            priority: 'medium',
            followUpRequired: false,
            threadLength: 'medium',
            complexity: 'simple'
          },
          templates: []
        },
        {
          type: 'project',
          frequency: 0.2,
          characteristics: {
            responseTime: 'within_day',
            priority: 'medium',
            followUpRequired: true,
            threadLength: 'long',
            complexity: 'complex'
          },
          templates: []
        }
      ],
      relationships: [],
      categories: []
    };
  }

  getIndividualTemplate(): InboxTemplate {
    return {
      userProfile: {
        role: 'individual',
        industry: 'technology',
        communicationStyle: 'casual',
        urgencyLevel: 'low',
        emailVolume: 'low',
        preferences: {
          responseTime: 'within_day',
          priorityLevel: 'low',
          followUpRequired: false,
          meetingPreferences: ['afternoon'],
          communicationChannels: ['email', 'slack']
        },
        timezone: 'America/New_York',
        workingHours: { start: '09:00', end: '17:00' }
      },
      emailCount: 150,
      timeRange: {
        start: '2024-01-01T00:00:00Z',
        end: '2024-12-31T23:59:59Z'
      },
      emailPatterns: [
        {
          type: 'urgent',
          frequency: 0.1,
          characteristics: {
            responseTime: 'within_day',
            priority: 'medium',
            followUpRequired: true,
            threadLength: 'short',
            complexity: 'simple'
          },
          templates: []
        },
        {
          type: 'follow-up',
          frequency: 0.2,
          characteristics: {
            responseTime: 'within_day',
            priority: 'low',
            followUpRequired: false,
            threadLength: 'short',
            complexity: 'simple'
          },
          templates: []
        },
        {
          type: 'meeting',
          frequency: 0.3,
          characteristics: {
            responseTime: 'within_day',
            priority: 'medium',
            followUpRequired: false,
            threadLength: 'short',
            complexity: 'simple'
          },
          templates: []
        },
        {
          type: 'project',
          frequency: 0.3,
          characteristics: {
            responseTime: 'within_day',
            priority: 'medium',
            followUpRequired: true,
            threadLength: 'medium',
            complexity: 'moderate'
          },
          templates: []
        },
        {
          type: 'newsletter',
          frequency: 0.1,
          characteristics: {
            responseTime: 'within_week',
            priority: 'low',
            followUpRequired: false,
            threadLength: 'short',
            complexity: 'simple'
          },
          templates: []
        }
      ],
      relationships: [],
      categories: []
    };
  }

  getMixedRoleTemplate(): InboxTemplate {
    return {
      userProfile: {
        role: 'mixed',
        industry: 'technology',
        communicationStyle: 'mixed',
        urgencyLevel: 'medium',
        emailVolume: 'medium',
        preferences: {
          responseTime: 'within_day',
          priorityLevel: 'medium',
          followUpRequired: true,
          meetingPreferences: ['morning', 'afternoon'],
          communicationChannels: ['email', 'calendar', 'slack']
        },
        timezone: 'America/New_York',
        workingHours: { start: '09:00', end: '17:00' }
      },
      emailCount: 400,
      timeRange: {
        start: '2024-01-01T00:00:00Z',
        end: '2024-12-31T23:59:59Z'
      },
      emailPatterns: [
        {
          type: 'urgent',
          frequency: 0.25,
          characteristics: {
            responseTime: 'within_hour',
            priority: 'high',
            followUpRequired: true,
            threadLength: 'short',
            complexity: 'moderate'
          },
          templates: []
        },
        {
          type: 'meeting',
          frequency: 0.35,
          characteristics: {
            responseTime: 'within_day',
            priority: 'medium',
            followUpRequired: false,
            threadLength: 'medium',
            complexity: 'simple'
          },
          templates: []
        },
        {
          type: 'follow-up',
          frequency: 0.25,
          characteristics: {
            responseTime: 'within_day',
            priority: 'medium',
            followUpRequired: true,
            threadLength: 'medium',
            complexity: 'moderate'
          },
          templates: []
        },
        {
          type: 'project',
          frequency: 0.15,
          characteristics: {
            responseTime: 'within_day',
            priority: 'medium',
            followUpRequired: true,
            threadLength: 'long',
            complexity: 'complex'
          },
          templates: []
        }
      ],
      relationships: [],
      categories: []
    };
  }

  /**
   * Get template by role
   */
  getTemplate(role: string): InboxTemplate | undefined {
    return this.templates.get(role);
  }

  /**
   * List available templates
   */
  getAvailableTemplates(): string[] {
    return Array.from(this.templates.keys());
  }
}
