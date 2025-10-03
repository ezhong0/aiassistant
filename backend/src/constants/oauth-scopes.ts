/**
 * OAuth Scopes Configuration
 * Centralized management of OAuth scopes for all providers
 */

export const OAUTH_SCOPES = {
  GOOGLE: {
    // Core identity scopes
    CORE: [
      'openid',
      'email',
      'profile',
    ],

    // Gmail scopes
    GMAIL: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
    ],

    // Calendar scopes
    CALENDAR: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],

    // Contacts scopes
    CONTACTS: [
      'https://www.googleapis.com/auth/contacts.readonly',
    ],

    // Combined scopes for different use cases
    FULL_ACCESS: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/contacts.readonly',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],
  },
} as const;

/**
 * Helper functions for scope management
 */
export class ScopeManager {
  /**
   * Get scopes for Google OAuth based on use case
   */
  static getGoogleScopes(useCase: 'full' | 'minimal'): string[] {
    switch (useCase) {
      case 'full':
        return [...OAUTH_SCOPES.GOOGLE.FULL_ACCESS];
      case 'minimal':
        return [...OAUTH_SCOPES.GOOGLE.CORE];
      default:
        return [...OAUTH_SCOPES.GOOGLE.CORE];
    }
  }

  /**
   * Validate if requested scopes are allowed
   */
  static validateScopes(provider: 'google', requestedScopes: string[]): boolean {
    const allowedScopes = [...OAUTH_SCOPES.GOOGLE.FULL_ACCESS];
    return requestedScopes.every(scope => allowedScopes.includes(scope));
  }
}