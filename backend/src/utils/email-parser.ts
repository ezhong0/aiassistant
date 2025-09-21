import { 
  GmailMessage, 
  ParsedEmail, 
  EmailContact, 
  EmailParsingOptions, 
  EmailMetadata,
  AttachmentType 
} from '../types/email/gmail.types';
import { getService } from '../services/service-manager';
import { OpenAIService } from '../services/openai.service';
import { EnhancedLogger, LogContext } from './enhanced-logger';

/**
 * Email parsing and formatting utilities
 */
export class EmailParser {
  
  /**
   * Parse a Gmail message into a more structured format using AI for importance
   */
  static async parseGmailMessage(message: GmailMessage, options: EmailParsingOptions = {}): Promise<ParsedEmail> {
    const defaultOptions: EmailParsingOptions = {
      extractPlainText: true,
      extractHtml: true,
      parseAttachments: true,
      maxBodyLength: 50000,
      ...options
    };

    try {
      return {
        id: message.id,
        threadId: message.threadId,
        subject: this.cleanSubject(message.subject),
        from: this.parseEmailAddress(message.from),
        to: this.parseEmailAddresses(message.to),
        cc: message.cc ? this.parseEmailAddresses(message.cc) : undefined,
        date: new Date(message.date),
        body: await this.parseEmailBody(message.body, defaultOptions),
        attachments: defaultOptions.parseAttachments ? message.attachments : [],
        isUnread: message.isUnread,
        labels: message.labelIds,
        importance: await this.determineImportance(message)
      };
    } catch (error) {
      EnhancedLogger.error('Failed to parse Gmail message', error as Error, {
        correlationId: `email-parse-${Date.now()}`,
        operation: 'email_parsing_error',
        metadata: { messageId: message.id }
      });
      throw new Error(`Failed to parse email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse email addresses from a string
   */
  static parseEmailAddresses(addressString: string): EmailContact[] {
    if (!addressString) return [];

    const addresses: EmailContact[] = [];
    
    // Split by comma but be careful of commas within quoted names
    const parts = this.splitEmailAddresses(addressString);
    
    for (const part of parts) {
      const contact = this.parseEmailAddress(part.trim());
      if (contact.email) {
        addresses.push(contact);
      }
    }

    return addresses;
  }

  /**
   * Parse a single email address
   */
  static parseEmailAddress(addressString: string): EmailContact {
    if (!addressString) return { email: '' };

    // Handle different formats:
    // "Name" <email@domain.com>
    // Name <email@domain.com>
    // email@domain.com
    
    const quotedNameMatch = addressString.match(/"([^"]+)"\s*<([^>]+)>/);
    if (quotedNameMatch) {
      return {
        name: quotedNameMatch[1]?.trim(),
        email: quotedNameMatch[2]?.trim() || ''
      };
    }

    const nameMatch = addressString.match(/^([^<]+)<([^>]+)>$/);
    if (nameMatch) {
      return {
        name: nameMatch[1]?.trim(),
        email: nameMatch[2]?.trim() || ''
      };
    }

    // Just an email address
    const emailMatch = addressString.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      return { email: emailMatch[1]?.trim() || '' };
    }

    return { email: addressString.trim() };
  }

  /**
   * Split email addresses accounting for quoted names with commas
   */
  private static splitEmailAddresses(addressString: string): string[] {
    const parts: string[] = [];
    let currentPart = '';
    let inQuotes = false;
    let bracketCount = 0;

    for (let i = 0; i < addressString.length; i++) {
      const char = addressString[i];
      
      if (char === '"' && (i === 0 || addressString[i - 1] !== '\\')) {
        inQuotes = !inQuotes;
      } else if (char === '<' && !inQuotes) {
        bracketCount++;
      } else if (char === '>' && !inQuotes) {
        bracketCount--;
      } else if (char === ',' && !inQuotes && bracketCount === 0) {
        parts.push(currentPart.trim());
        currentPart = '';
        continue;
      }
      
      currentPart += char;
    }
    
    if (currentPart.trim()) {
      parts.push(currentPart.trim());
    }
    
    return parts;
  }

  /**
   * Parse email body into text and HTML
   */
  static async parseEmailBody(body: string, options: EmailParsingOptions): Promise<{ text?: string; html?: string }> {
    if (!body) return {};

    const result: { text?: string; html?: string } = {};
    
    // Truncate if too long
    const truncatedBody = options.maxBodyLength && body.length > options.maxBodyLength
      ? body.substring(0, options.maxBodyLength) + '...'
      : body;

    // Detect if it's HTML or plain text
    const isHtml = /<[a-z][\s\S]*>/i.test(truncatedBody);

    if (isHtml) {
      if (options.extractHtml) {
        result.html = truncatedBody;
      }
      if (options.extractPlainText) {
        result.text = await this.htmlToText(truncatedBody);
      }
    } else {
      if (options.extractPlainText) {
        result.text = truncatedBody;
      }
      if (options.extractHtml) {
        result.html = this.textToHtml(truncatedBody);
      }
    }

    return result;
  }

  /**
   * Convert HTML to plain text
   */
  /**
   * AI-powered HTML to text conversion with intelligent content analysis
   */
  static async htmlToText(html: string): Promise<string> {
    try {
      const openaiService = getService<OpenAIService>('openaiService');
      if (!openaiService) {
        // Fallback to basic processing if AI service unavailable
        return this.fallbackHtmlToText(html);
      }

      const prompt = `Convert this HTML content to clean, readable plain text while preserving important structure and content:

HTML Content:
${html.substring(0, 2000)}${html.length > 2000 ? '...' : ''}

Guidelines:
- Preserve paragraph breaks and section structure
- Convert lists to readable bullet points or numbered lists
- Extract important text content while removing formatting
- Maintain logical reading flow
- Remove scripts, styles, and navigation elements
- Convert links to readable format like "Text (URL)"
- Preserve important whitespace and line breaks
- Remove excessive whitespace and empty lines

Return only the clean plain text content.`;

      const response = await openaiService.generateText(
        prompt,
        'You are an expert at converting HTML to clean, readable plain text while preserving content structure and meaning.',
        { temperature: 0.1, maxTokens: 1000 }
      );

      const cleanText = response.trim();

      console.log('AI-powered HTML to text conversion completed', {
        originalLength: html.length,
        processedLength: cleanText.length
      });

      return cleanText;

    } catch (error) {
      console.error('AI HTML processing failed, using fallback', error);

      // Fallback to basic regex processing on error
      return this.fallbackHtmlToText(html);
    }
  }

  /**
   * Fallback HTML to text conversion using basic regex patterns
   * Used when AI service is unavailable
   */
  private static fallbackHtmlToText(html: string): string {
    return html
      // Remove script and style elements
      .replace(/<(script|style)[^>]*>.*?<\/\1>/gis, '')
      // Replace common HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Convert line breaks
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      // Remove all other HTML tags
      .replace(/<[^>]+>/g, '')
      // Clean up whitespace
      .replace(/\n\s*\n/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  /**
   * Convert plain text to HTML
   */
  static textToHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\n/g, '<br>')
      .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
  }

  /**
   * Clean email subject
   */
  static cleanSubject(subject: string): string {
    if (!subject) return '';
    
    return subject
      .replace(/^(Re:\s*)+/i, 'Re: ')
      .replace(/^(Fwd?:\s*)+/i, 'Fwd: ')
      .trim();
  }

  /**
   * Determine email importance using AI instead of keyword arrays
   * Replaces urgentKeywords and lowPriorityKeywords arrays with AI classification
   */
  static async determineImportance(message: GmailMessage): Promise<'high' | 'normal' | 'low'> {
    try {
      // Check labels for importance markers first (this is still valid)
      if (message.labelIds.includes('IMPORTANT')) {
        return 'high';
      }
      
      // AI-powered priority classification
      return await this.classifyEmailPriorityWithAI(message);
    } catch (error) {
      EnhancedLogger.error('Failed to classify email priority', error as Error, {
        correlationId: `email-priority-${Date.now()}`,
        operation: 'email_priority_classification_error'
      });
      // Return default priority on error
      return 'normal';
    }
  }

  /**
   * Extract metadata from email headers using AI for importance
   */
  static async extractMetadata(message: GmailMessage): Promise<EmailMetadata> {
    return {
      messageId: message.messageId,
      threadId: message.threadId,
      // These would need to be extracted from the full headers if available
      references: undefined,
      inReplyTo: undefined,
      importance: await this.determineImportance(message),
      autoReplied: false,
      listUnsubscribe: undefined,
      deliveredTo: undefined,
      returnPath: undefined
    };
  }

  /**
   * Format email for display
   */
  static formatEmailForDisplay(email: ParsedEmail): string {
    const fromDisplay = email.from.name 
      ? `${email.from.name} <${email.from.email}>`
      : email.from.email;
    
    const toDisplay = email.to
      .map(contact => contact.name ? `${contact.name} <${contact.email}>` : contact.email)
      .join(', ');

    const dateDisplay = email.date.toLocaleString();
    
    return [
      `From: ${fromDisplay}`,
      `To: ${toDisplay}`,
      email.cc && email.cc.length > 0 ? `Cc: ${email.cc.map(contact => 
        contact.name ? `${contact.name} <${contact.email}>` : contact.email
      ).join(', ')}` : '',
      `Date: ${dateDisplay}`,
      `Subject: ${email.subject}`,
      email.attachments.length > 0 ? `Attachments: ${email.attachments.length}` : '',
      '',
      email.body.text || email.body.html || ''
    ].filter(Boolean).join('\n');
  }

  /**
   * Create email signature
   */
  static createEmailSignature(name: string, title?: string, company?: string, phone?: string): string {
    const parts = [
      `--`,
      name,
      title,
      company,
      phone
    ].filter(Boolean);
    
    return parts.join('\n');
  }

  /**
   * Parse email thread to identify conversation flow using AI for importance
   */
  static async parseThread(messages: GmailMessage[]): Promise<ParsedEmail[]> {
    const parsedMessages = await Promise.all(
      messages
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(message => this.parseGmailMessage(message))
    );
    return parsedMessages;
  }

  /**
   * Detect attachment type
   */
  static getAttachmentType(mimeType: string): AttachmentType {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    
    const documentTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv'
    ];
    
    if (documentTypes.includes(mimeType)) return 'document';
    
    return 'other';
  }

  /**
   * Generate email preview text
   */
  static async generatePreview(body: string, maxLength: number = 150): Promise<string> {
    const text = typeof body === 'string' ? await this.htmlToText(body) : body;
    return text.length > maxLength 
      ? text.substring(0, maxLength).trim() + '...'
      : text.trim();
  }

  /**
   * Validate email address format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  /**
   * Extract mentioned emails from email body
   */
  static extractMentionedEmails(body: string): string[] {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = body.match(emailRegex);
    return matches ? [...new Set(matches)] : [];
  }

  /**
   * Check if email is automated/system generated
   */
  static isAutomatedEmail(email: ParsedEmail): boolean {
    const automatedIndicators = [
      'noreply',
      'no-reply',
      'donotreply',
      'automated',
      'system',
      'notification',
      'alerts',
      'bounce'
    ];
    
    const fromEmail = email.from.email.toLowerCase();
    return automatedIndicators.some(indicator => fromEmail.includes(indicator));
  }

  /**
   * AI-powered email priority classification
   */
  private static async classifyEmailPriorityWithAI(message: GmailMessage): Promise<'high' | 'normal' | 'low'> {
    try {
      const openaiService = getService<OpenAIService>('openaiService');
      if (!openaiService) {
        // Fallback to simple keyword detection if AI service unavailable
        const content = `${message.subject || ''} ${message.snippet || ''}`.toLowerCase();
        const urgentKeywords = ['urgent', 'asap', 'emergency', 'critical', 'important', 'deadline'];
        const lowPriorityKeywords = ['newsletter', 'unsubscribe', 'promotion', 'marketing', 'spam'];

        if (urgentKeywords.some(keyword => content.includes(keyword))) return 'high';
        if (lowPriorityKeywords.some(keyword => content.includes(keyword))) return 'low';
        return 'normal';
      }

      const content = `Subject: ${message.subject || '(no subject)'}
From: ${message.from || '(unknown sender)'}
Preview: ${message.snippet || '(no preview)'}`;

      const prompt = `Analyze this email and classify its priority level:

${content}

Priority levels:
- high: Urgent, time-sensitive, important business matters, deadlines, emergencies
- normal: Regular business communication, personal emails, general inquiries
- low: Newsletters, promotions, automated emails, spam, marketing

Examples:
- "URGENT: Server down" → high
- "Meeting tomorrow at 2pm" → normal
- "Weekly newsletter" → low
- "Password reset" → normal
- "Limited time offer!" → low

Return only: high, normal, or low`;

      const response = await openaiService.generateText(
        prompt,
        'You are an expert at classifying email priority. Return only the priority level.',
        { temperature: 0.1, maxTokens: 10 }
      );

      const priority = response.trim().toLowerCase();

      // Validate response
      if (['high', 'normal', 'low'].includes(priority)) {
        return priority as 'high' | 'normal' | 'low';
      }

      return 'normal'; // Default fallback

    } catch (error) {
      // Fallback to simple keyword detection on error
      const content = `${message.subject || ''} ${message.snippet || ''}`.toLowerCase();
      const urgentKeywords = ['urgent', 'asap', 'emergency', 'critical', 'important', 'deadline'];
      const lowPriorityKeywords = ['newsletter', 'unsubscribe', 'promotion', 'marketing', 'spam'];

      if (urgentKeywords.some(keyword => content.includes(keyword))) return 'high';
      if (lowPriorityKeywords.some(keyword => content.includes(keyword))) return 'low';
      return 'normal';
    }
  }
}

/**
 * Email formatting utilities
 */
export class EmailFormatter {
  
  /**
   * Format email as markdown
   */
  static toMarkdown(email: ParsedEmail): string {
    const from = email.from.name ? `**${email.from.name}** <${email.from.email}>` : `**${email.from.email}**`;
    const to = email.to.map(contact => 
      contact.name ? `${contact.name} <${contact.email}>` : contact.email
    ).join(', ');

    return [
      `## ${email.subject}`,
      '',
      `**From:** ${from}`,
      `**To:** ${to}`,
      email.cc && email.cc.length > 0 ? `**Cc:** ${email.cc.map(contact => 
        contact.name ? `${contact.name} <${contact.email}>` : contact.email
      ).join(', ')}` : '',
      `**Date:** ${email.date.toLocaleString()}`,
      email.attachments.length > 0 ? `**Attachments:** ${email.attachments.length}` : '',
      '',
      '---',
      '',
      email.body.text || email.body.html || ''
    ].filter(Boolean).join('\n');
  }

  /**
   * Format email as JSON
   */
  static toJSON(email: ParsedEmail): string {
    return JSON.stringify(email, null, 2);
  }

  /**
   * Create email template with variables
   */
  static createTemplate(subject: string, body: string, variables: string[]): {
    subject: string;
    body: string;
    variables: string[];
  } {
    return {
      subject,
      body,
      variables
    };
  }

  /**
   * Apply variables to email template
   */
  static applyTemplate(
    template: { subject: string; body: string; variables: string[] },
    values: Record<string, string>
  ): { subject: string; body: string } {
    let subject = template.subject;
    let body = template.body;

    for (const variable of template.variables) {
      const value = values[variable] || '';
      const regex = new RegExp(`{{${variable}}}`, 'g');
      subject = subject.replace(regex, value);
      body = body.replace(regex, value);
    }

    return { subject, body };
  }
}