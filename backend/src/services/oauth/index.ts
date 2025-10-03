/**
 * OAuth Managers - Shared OAuth management for domain services
 *
 * This module exports OAuth managers that provide unified OAuth interfaces
 * for different service providers. These managers handle OAuth flows,
 * token management, and validation for their respective domains.
 */

// Export OAuth managers
export { GoogleOAuthManager } from './google-oauth-manager';

// Export types
export type { GoogleOAuthConfig, GoogleOAuthResult, GoogleOAuthValidationResult } from './google-oauth-manager';
