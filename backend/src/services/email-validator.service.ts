import { BaseService } from './base-service';
import { SendEmailRequest, SearchEmailsRequest, ReplyEmailRequest } from '../types/gmail.types';
import logger from '../utils/logger';

/**
 * Email validation result
 */
export interface EmailValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  validatedRequest?: SendEmailRequest | SearchEmailsRequest | ReplyEmailRequest;
}

/**
 * Email permission result
 */
export interface EmailPermissionResult {
  hasPermission: boolean;
  missingPermissions: string[];
  error?: string;
}

/**
 * EmailValidator - Focused service for email validation and permission checking
 * Handles validation of email requests, content, and user permissions
 */
export class EmailValidator extends BaseService {

  constructor() {
    super('EmailValidator');
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing EmailValidator...');
      this.logInfo('EmailValidator initialized successfully');
    } catch (error) {
      this.handleError(error, 'onInitialize');
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.logInfo('EmailValidator destroyed successfully');
    } catch (error) {
      this.logError('Error during EmailValidator destruction', error);
    }
  }

  /**
   * Validate send email request
   */
  validateSendEmailRequest(request: SendEmailRequest): EmailValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate required fields
      const toEmail = Array.isArray(request.to) ? request.to[0] : request.to;
      if (!toEmail || toEmail.trim().length === 0) {
        errors.push('Recipient email address is required');
      } else if (!this.isValidEmailFormat(toEmail)) {
        errors.push('Invalid recipient email format');
      }

      if (!request.subject || request.subject.trim().length === 0) {
        errors.push('Email subject is required');
      } else if (request.subject.length > 998) {
        errors.push('Email subject is too long (max 998 characters)');
      }

      if (!request.body || request.body.trim().length === 0) {
        errors.push('Email body is required');
      }

      // Validate optional fields
      if (request.cc) {
        const ccEmails = Array.isArray(request.cc) ? request.cc : [request.cc];
        const invalidCC = ccEmails.filter((email: string) => !this.isValidEmailFormat(email));
        if (invalidCC.length > 0) {
          errors.push(`Invalid CC email addresses: ${invalidCC.join(', ')}`);
        }
      }

      if (request.bcc) {
        const bccEmails = Array.isArray(request.bcc) ? request.bcc : [request.bcc];
        const invalidBCC = bccEmails.filter((email: string) => !this.isValidEmailFormat(email));
        if (invalidBCC.length > 0) {
          errors.push(`Invalid BCC email addresses: ${invalidBCC.join(', ')}`);
        }
      }

      // Content validation
      if (request.body && request.body.length > 1000000) {
        warnings.push('Email body is very long, consider shortening');
      }

      // Check for suspicious content
      if (request.body && this.containsSuspiciousContent(request.body)) {
        warnings.push('Email content may be flagged as spam');
      }

      const isValid = errors.length === 0;

      this.logInfo('Send email request validation completed', {
        isValid,
        errorCount: errors.length,
        warningCount: warnings.length
      });

      return {
        isValid,
        errors,
        warnings,
        validatedRequest: isValid ? request : undefined
      };
    } catch (error) {
      this.logError('Error validating send email request', error);
      return {
        isValid: false,
        errors: ['Validation failed'],
        warnings: []
      };
    }
  }

  /**
   * Validate search emails request
   */
  validateSearchEmailsRequest(request: SearchEmailsRequest): EmailValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate required fields
      if (!request.query || request.query.trim().length === 0) {
        errors.push('Search query is required');
      }

      // Validate optional fields
      if (request.maxResults && (request.maxResults < 1 || request.maxResults > 500)) {
        errors.push('Max results must be between 1 and 500');
      }

      if (request.pageToken && request.pageToken.trim().length === 0) {
        errors.push('Invalid page token');
      }

      // Check for potentially expensive queries
      if (request.query && this.isExpensiveQuery(request.query)) {
        warnings.push('This search query may take a long time to execute');
      }

      const isValid = errors.length === 0;

      this.logInfo('Search emails request validation completed', {
        isValid,
        errorCount: errors.length,
        warningCount: warnings.length,
        queryLength: request.query?.length
      });

      return {
        isValid,
        errors,
        warnings,
        validatedRequest: isValid ? request : undefined
      };
    } catch (error) {
      this.logError('Error validating search emails request', error);
      return {
        isValid: false,
        errors: ['Validation failed'],
        warnings: []
      };
    }
  }

  /**
   * Validate reply email request
   */
  validateReplyEmailRequest(request: ReplyEmailRequest): EmailValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate required fields
      if (!request.messageId || request.messageId.trim().length === 0) {
        errors.push('Message ID is required for reply');
      }

      if (!request.body || request.body.trim().length === 0) {
        errors.push('Reply body is required');
      }

      // Content validation
      if (request.body && request.body.length > 1000000) {
        warnings.push('Reply body is very long, consider shortening');
      }

      const isValid = errors.length === 0;

      this.logInfo('Reply email request validation completed', {
        isValid,
        errorCount: errors.length,
        warningCount: warnings.length,
        messageId: request.messageId
      });

      return {
        isValid,
        errors,
        warnings,
        validatedRequest: isValid ? request : undefined
      };
    } catch (error) {
      this.logError('Error validating reply email request', error);
      return {
        isValid: false,
        errors: ['Validation failed'],
        warnings: []
      };
    }
  }

  /**
   * Check email permissions for user
   */
  async checkEmailPermissions(userId: string, accessToken: string): Promise<EmailPermissionResult> {
    try {
      // Basic permission check - in a real implementation, you'd check OAuth scopes
      const requiredPermissions = [
        'gmail.readonly',
        'gmail.send',
        'gmail.compose'
      ];

      // For now, assume permissions are valid if we have an access token
      // In a real implementation, you'd validate the token's scopes
      if (!accessToken || accessToken.trim().length === 0) {
        return {
          hasPermission: false,
          missingPermissions: requiredPermissions,
          error: 'No access token provided'
        };
      }

      this.logInfo('Email permissions check completed', {
        userId,
        hasPermission: true
      });

      return {
        hasPermission: true,
        missingPermissions: []
      };
    } catch (error) {
      this.logError('Error checking email permissions', error);
      return {
        hasPermission: false,
        missingPermissions: ['gmail.readonly', 'gmail.send', 'gmail.compose'],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate email format
   */
  private isValidEmailFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Check for suspicious content
   */
  private containsSuspiciousContent(content: string): boolean {
    const suspiciousPatterns = [
      /free money/i,
      /click here/i,
      /urgent/i,
      /act now/i,
      /limited time/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check if query is expensive
   */
  private isExpensiveQuery(query: string): boolean {
    const expensivePatterns = [
      /has:attachment/i,
      /larger:\d+/i,
      /older_than:\d+/i,
      /newer_than:\d+/i
    ];

    return expensivePatterns.some(pattern => pattern.test(query));
  }

  /**
   * Get validator statistics
   */
  getValidatorStats(): {
    serviceName: string;
    validationMethods: string[];
  } {
    return {
      serviceName: 'EmailValidator',
      validationMethods: [
        'validateSendEmailRequest',
        'validateSearchEmailsRequest',
        'validateReplyEmailRequest',
        'checkEmailPermissions'
      ]
    };
  }
}
