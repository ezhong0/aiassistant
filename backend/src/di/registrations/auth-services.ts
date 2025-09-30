import { asClass } from 'awilix';
import { AppContainer } from '../container';
import { AuthService } from '../../services/auth.service';
import { TokenStorageService } from '../../services/token-storage.service';
import { TokenManager } from '../../services/token-manager';
import { AuthStatusService } from '../../services/auth-status.service';
import { OAuthStateService } from '../../services/oauth-state.service';
import { GoogleOAuthManager } from '../../services/oauth/google-oauth-manager';
import { SlackOAuthManager } from '../../services/oauth/slack-oauth-manager';

/**
 * Register authentication and authorization services
 * 
 * These services handle OAuth flows, token management,
 * and user authentication state.
 */
export function registerAuthServices(container: AppContainer): void {
  container.register({
    // OAuth state management (depends on cacheService)
    oauthStateService: asClass(OAuthStateService).singleton(),

    // Core authentication service
    authService: asClass(AuthService).singleton(),

    // Token storage service (depends on databaseService, cacheService)
    tokenStorageService: asClass(TokenStorageService).singleton(),

    // Token management (depends on tokenStorageService, authService)
    tokenManager: asClass(TokenManager).singleton(),

    // Auth status service (depends on tokenStorageService, tokenManager)
    authStatusService: asClass(AuthStatusService).singleton(),

    // OAuth managers (pass primitives directly to avoid Awilix proxy issues)
    googleOAuthManager: asClass(GoogleOAuthManager)
      .singleton()
      .inject(() => {
        // Create config object outside of return to avoid proxy
        const clientId = process.env.GOOGLE_CLIENT_ID || '';
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
        const redirectUri = process.env.GOOGLE_REDIRECT_URI || '';
        const scopes = [
          'openid',
          'email',
          'profile',
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/contacts.readonly'
        ];
        
        return {
          clientId,
          clientSecret,
          redirectUri,
          scopes,
          authService: container.resolve('authService'),
          tokenManager: container.resolve('tokenManager'),
          oauthStateService: container.resolve('oauthStateService')
        };
      }),

    slackOAuthManager: asClass(SlackOAuthManager)
      .singleton()
      .inject(() => {
        const clientId = process.env.SLACK_CLIENT_ID || '';
        const clientSecret = process.env.SLACK_CLIENT_SECRET || '';
        const redirectUri = process.env.SLACK_REDIRECT_URI || '';
        const scopes = ['chat:write', 'channels:read', 'users:read'];
        
        return {
          clientId,
          clientSecret,
          redirectUri,
          scopes,
          tokenManager: container.resolve('tokenManager'),
          oauthStateService: container.resolve('oauthStateService')
        };
      }),
  });
}
