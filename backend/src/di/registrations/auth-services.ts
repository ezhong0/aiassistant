import { asClass } from 'awilix';
import { AppContainer } from '../container';
import { AuthService } from '../../services/auth.service';
import { TokenStorageService } from '../../services/token-storage.service';
import { TokenManager } from '../../services/token-manager';
import { AuthStatusService } from '../../services/auth-status.service';
import { OAuthStateService } from '../../services/oauth-state.service';
import { GoogleOAuthManager } from '../../services/oauth/google-oauth-manager';

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

    // OAuth managers - Configuration primitives injected via factory, services auto-resolved
    // Note: Using .inject() for configuration primitives is a valid DI pattern
    // Services (authService, tokenManager, oauthStateService) are auto-injected by Awilix
    googleOAuthManager: asClass(GoogleOAuthManager)
      .singleton()
      .inject(() => {
        const config = container.cradle.config;
        return {
          clientId: config.auth?.google?.clientId || '',
          clientSecret: config.auth?.google?.clientSecret || '',
          redirectUri: config.auth?.google?.redirectUri || '',
          scopes: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/contacts.readonly'
          ]
        };
      }),
  });
}
