/**
 * OAuth Managers - Shared OAuth management for domain services
 * 
 * This module exports OAuth managers that provide unified OAuth interfaces
 * for different service providers. These managers handle OAuth flows,
 * token management, and validation for their respective domains.
 */

// Export OAuth managers
export { GoogleOAuthManager } from './google-oauth-manager';
export { SlackOAuthManager } from './slack-oauth-manager';

// Export types
export type { GoogleOAuthConfig, GoogleOAuthResult, GoogleOAuthValidationResult } from './google-oauth-manager';
export type { SlackOAuthConfig, SlackOAuthResult, SlackOAuthValidationResult } from './slack-oauth-manager';
