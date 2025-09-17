/**
 * Constants for Email Services
 * Centralizes all hardcoded strings to avoid magic strings throughout the codebase
 */

export const EMAIL_SERVICE_CONSTANTS = {
  // Service Names
  SERVICE_NAMES: {
    EMAIL_OPERATION_HANDLER: 'emailOperationHandler',
    CONTACT_RESOLVER: 'contactResolver',
    EMAIL_VALIDATOR: 'emailValidator',
    EMAIL_FORMATTER: 'emailFormatter',
    GMAIL_SERVICE: 'gmailService',
    CONTACT_SERVICE: 'contactService'
  },

  // Error Messages
  ERRORS: {
    SERVICE_NOT_AVAILABLE: 'Service not available',
    GMAIL_SERVICE_NOT_AVAILABLE: 'GmailService not available',
    CONTACT_SERVICE_NOT_AVAILABLE: 'ContactService not available',
    EMAIL_VALIDATOR_NOT_AVAILABLE: 'EmailValidator not available',
    RECIPIENT_EMAIL_REQUIRED: 'Recipient email is required',
    SEARCH_QUERY_REQUIRED: 'Search query is required',
    EMAIL_ID_REQUIRED: 'Email ID is required',
    MESSAGE_ID_REQUIRED: 'Message ID is required for reply',
    REPLY_BODY_REQUIRED: 'Reply body is required',
    EMAIL_SUBJECT_REQUIRED: 'Email subject is required',
    EMAIL_BODY_REQUIRED: 'Email body is required',
    VALIDATION_FAILED: 'Validation failed',
    EMAIL_SENDING_FAILED: 'Email sending failed',
    EMAIL_SEARCH_FAILED: 'Email search failed',
    EMAIL_REPLY_FAILED: 'Email reply failed',
    EMAIL_RETRIEVAL_FAILED: 'Email retrieval failed',
    UNKNOWN_ERROR: 'Unknown error',
    NO_ACCESS_TOKEN: 'No access token provided',
    EMAIL_VALIDATION_FAILED: 'Email validation failed',
    FORMATTING_FAILED: 'Failed to format error message',
    NO_CONTACTS_FOUND: 'No contacts found',
    INVALID_EMAIL_FORMAT: 'Invalid email format',
    EMAIL_FORMAT_TOO_LONG: 'Email subject is too long (max 998 characters)',
    EMAIL_BODY_TOO_LONG: 'Email body is very long, consider shortening',
    MAX_RESULTS_INVALID: 'Max results must be between 1 and 500',
    INVALID_PAGE_TOKEN: 'Invalid page token',
    EXPENSIVE_QUERY_WARNING: 'This search query may take a long time to execute',
    SPAM_WARNING: 'Email content may be flagged as spam'
  },

  // Success Messages
  SUCCESS: {
    EMAIL_SENT: 'Email sent successfully',
    EMAIL_SEARCH_COMPLETED: 'Email search completed',
    EMAIL_REPLY_SENT: 'Email reply sent successfully',
    EMAIL_RETRIEVED: 'Email retrieved successfully',
    EMAIL_THREAD_RETRIEVED: 'Email thread retrieved successfully',
    CONTACT_RESOLVED_EXACT: 'Contact resolved by exact match',
    CONTACT_RESOLVED_FUZZY: 'Contact resolved by fuzzy match',
    VALIDATION_COMPLETED: 'Validation completed',
    PERMISSIONS_CHECK_COMPLETED: 'Email permissions check completed',
    DISAMBIGUATION_COMPLETED: 'Contact disambiguation completed'
  },

  // Validation Types
  VALIDATION_TYPES: {
    EMAIL_FORMAT: 'email_format',
    CONTACT_EXISTS: 'contact_exists',
    INVALID: 'invalid'
  },

  // Resolution Methods
  RESOLUTION_METHODS: {
    EXACT_MATCH: 'exact_match',
    FUZZY_MATCH: 'fuzzy_match',
    NOT_FOUND: 'not_found'
  },

  // Email Actions
  EMAIL_ACTIONS: {
    SEND: 'send',
    SEARCH: 'search',
    REPLY: 'reply',
    DRAFT: 'draft',
    GET: 'get'
  },

  // OAuth Permissions
  OAUTH_PERMISSIONS: {
    GMAIL_READONLY: 'gmail.readonly',
    GMAIL_SEND: 'gmail.send',
    GMAIL_COMPOSE: 'gmail.compose'
  },

  // Default Values - Removed hardcoded fallbacks
  DEFAULTS: {
    NO_SUBJECT: 'No Subject',
    UNKNOWN_SENDER: 'Unknown Sender',
    UNKNOWN_DATE: 'Unknown Date',
    EMAIL_OPERATION_COMPLETED: 'Email operation completed'
  },

  // Formatting
  FORMATTING: {
    EMAIL_SENT_SUCCESS: '✅ **Email sent successfully!**',
    EMAIL_REPLY_SUCCESS: '✅ **Reply sent successfully!**',
    EMAIL_DRAFT_SUCCESS: '📝 **Email draft created successfully!**',
    EMAIL_DETAILS: '📧 **Email Details**',
    EMAIL_CONTENT: '**Content:**',
    EMAIL_TIP: '💡 **Tip:** You can edit and send this draft later.',
    NO_EMAILS_FOUND: '🔍 **No emails found** matching your search criteria.',
    NO_EMAIL_FOUND: '❌ **No email found** with the specified ID.',
    RECENT_EMAILS: '**Recent emails:**',
    EMAIL_SUBJECT_LABEL: '📝 **Subject:**',
    EMAIL_FROM_LABEL: '👤 **From:**',
    EMAIL_DATE_LABEL: '📅 **Date:**',
    EMAIL_TO_LABEL: '📧 **To:**',
    EMAIL_MESSAGE_ID_LABEL: '🆔 **Message ID:**',
    EMAIL_THREAD_ID_LABEL: '🧵 **Thread ID:**',
    EMAIL_DRAFT_ID_LABEL: '🆔 **Draft ID:**'
  },

  // Limits
  LIMITS: {
    MAX_SUBJECT_LENGTH: 998,
    MAX_EMAIL_BODY_LENGTH: 1000000,
    MAX_SEARCH_RESULTS: 500,
    MIN_SEARCH_RESULTS: 1,
    DEFAULT_SEARCH_RESULTS: 10,
    MAX_DISPLAY_EMAILS: 5,
    MAX_TEXT_TRUNCATE: 500
  }
} as const;

export type EmailServiceConstants = typeof EMAIL_SERVICE_CONSTANTS;
