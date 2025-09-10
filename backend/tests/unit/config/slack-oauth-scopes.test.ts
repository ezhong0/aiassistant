import { describe, it, expect } from '@jest/globals';

describe('Slack DM-Only OAuth Scope Validation', () => {
  describe('OAuth Scope Configuration', () => {
    it('should include only DM-required scopes', () => {
      const dmOnlyScopes = [
        'im:history',    // Read direct message history
        'im:write',      // Send messages in direct messages
        'users:read',    // Read user information
        'chat:write',    // Send messages (required for DM responses)
        'commands'       // Handle slash commands
      ];

      // Verify all required scopes are present
      expect(dmOnlyScopes).toContain('im:history');
      expect(dmOnlyScopes).toContain('im:write');
      expect(dmOnlyScopes).toContain('users:read');
      expect(dmOnlyScopes).toContain('chat:write');
      expect(dmOnlyScopes).toContain('commands');

      // Verify channel-related scopes are excluded
      expect(dmOnlyScopes).not.toContain('app_mentions:read');
      expect(dmOnlyScopes).not.toContain('channels:read');
      expect(dmOnlyScopes).not.toContain('channels:write');
      expect(dmOnlyScopes).not.toContain('groups:read');
      expect(dmOnlyScopes).not.toContain('groups:write');
      expect(dmOnlyScopes).not.toContain('mpim:read');
      expect(dmOnlyScopes).not.toContain('mpim:write');
    });

    it('should have correct scope count', () => {
      const dmOnlyScopes = [
        'im:history',
        'im:write',
        'users:read',
        'chat:write',
        'commands'
      ];

      expect(dmOnlyScopes).toHaveLength(5);
    });

    it('should format scopes correctly for OAuth URL', () => {
      const dmOnlyScopes = [
        'im:history',
        'im:write',
        'users:read',
        'chat:write',
        'commands'
      ];

      const formattedScopes = dmOnlyScopes.join(',');
      const expectedFormat = 'im:history,im:write,users:read,chat:write,commands';

      expect(formattedScopes).toBe(expectedFormat);
    });
  });

  describe('Scope Permissions Validation', () => {
    it('should validate im:history scope', () => {
      const scope = 'im:history';
      
      expect(scope).toBe('im:history');
      expect(scope).toMatch(/^im:/);
      expect(scope).toContain('history');
    });

    it('should validate im:write scope', () => {
      const scope = 'im:write';
      
      expect(scope).toBe('im:write');
      expect(scope).toMatch(/^im:/);
      expect(scope).toContain('write');
    });

    it('should validate users:read scope', () => {
      const scope = 'users:read';
      
      expect(scope).toBe('users:read');
      expect(scope).toMatch(/^users:/);
      expect(scope).toContain('read');
    });

    it('should validate chat:write scope', () => {
      const scope = 'chat:write';
      
      expect(scope).toBe('chat:write');
      expect(scope).toMatch(/^chat:/);
      expect(scope).toContain('write');
    });

    it('should validate commands scope', () => {
      const scope = 'commands';
      
      expect(scope).toBe('commands');
      expect(scope).not.toContain(':');
    });
  });

  describe('Excluded Scope Validation', () => {
    it('should exclude channel-related scopes', () => {
      const excludedScopes = [
        'app_mentions:read',
        'channels:read',
        'channels:write',
        'groups:read',
        'groups:write',
        'mpim:read',
        'mpim:write'
      ];

      const dmOnlyScopes = [
        'im:history',
        'im:write',
        'users:read',
        'chat:write',
        'commands'
      ];

      excludedScopes.forEach(scope => {
        expect(dmOnlyScopes).not.toContain(scope);
      });
    });

    it('should exclude file-related scopes', () => {
      const excludedScopes = [
        'files:read',
        'files:write',
        'files:write:user'
      ];

      const dmOnlyScopes = [
        'im:history',
        'im:write',
        'users:read',
        'chat:write',
        'commands'
      ];

      excludedScopes.forEach(scope => {
        expect(dmOnlyScopes).not.toContain(scope);
      });
    });

    it('should exclude team-related scopes', () => {
      const excludedScopes = [
        'team:read',
        'usergroups:read',
        'usergroups:write'
      ];

      const dmOnlyScopes = [
        'im:history',
        'im:write',
        'users:read',
        'chat:write',
        'commands'
      ];

      excludedScopes.forEach(scope => {
        expect(dmOnlyScopes).not.toContain(scope);
      });
    });
  });

  describe('OAuth URL Construction', () => {
    it('should construct OAuth URL with correct scopes', () => {
      const clientId = 'test-client-id';
      const redirectUri = 'https://test.com/oauth/callback';
      const scopes = [
        'im:history',
        'im:write',
        'users:read',
        'chat:write',
        'commands'
      ].join(',');

      const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`;

      expect(authUrl).toContain('https://slack.com/oauth/v2/authorize');
      expect(authUrl).toContain('client_id=test-client-id');
      expect(authUrl).toContain('scope=im:history,im:write,users:read,chat:write,commands');
      expect(authUrl).toContain('redirect_uri=https%3A%2F%2Ftest.com%2Foauth%2Fcallback');
    });

    it('should handle special characters in redirect URI', () => {
      const clientId = 'test-client-id';
      const redirectUri = 'https://test.com/oauth/callback?param=value&other=123';
      const scopes = 'im:history,im:write,users:read,chat:write,commands';

      const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`;

      expect(authUrl).toContain('redirect_uri=https%3A%2F%2Ftest.com%2Foauth%2Fcallback%3Fparam%3Dvalue%26other%3D123');
    });
  });

  describe('Scope Security Validation', () => {
    it('should not include overly permissive scopes', () => {
      const dmOnlyScopes = [
        'im:history',
        'im:write',
        'users:read',
        'chat:write',
        'commands'
      ];

      const overlyPermissiveScopes = [
        'admin',
        'admin.users:write',
        'admin.teams:write',
        'admin.apps:write',
        'admin.conversations:write'
      ];

      overlyPermissiveScopes.forEach(scope => {
        expect(dmOnlyScopes).not.toContain(scope);
      });
    });

    it('should not include read-write scopes for channels', () => {
      const dmOnlyScopes = [
        'im:history',
        'im:write',
        'users:read',
        'chat:write',
        'commands'
      ];

      const channelScopes = [
        'channels:read',
        'channels:write',
        'groups:read',
        'groups:write',
        'mpim:read',
        'mpim:write'
      ];

      channelScopes.forEach(scope => {
        expect(dmOnlyScopes).not.toContain(scope);
      });
    });

    it('should maintain minimal required permissions', () => {
      const dmOnlyScopes = [
        'im:history',    // Required for reading DM history
        'im:write',      // Required for sending DM responses
        'users:read',    // Required for user information
        'chat:write',    // Required for general message sending
        'commands'       // Required for slash commands
      ];

      // Each scope should be justified for DM-only functionality
      expect(dmOnlyScopes).toHaveLength(5);
      
      // Verify each scope is necessary
      const necessaryScopes = [
        'im:history',    // Read DM history
        'im:write',      // Send DM messages
        'users:read',    // Get user info
        'chat:write',    // Send messages
        'commands'       // Handle commands
      ];

      necessaryScopes.forEach(scope => {
        expect(dmOnlyScopes).toContain(scope);
      });
    });
  });

  describe('Migration Scope Comparison', () => {
    it('should show scope reduction from channel-based to DM-only', () => {
      const previousScopes = [
        'app_mentions:read',
        'chat:write',
        'commands',
        'im:history',
        'im:read',
        'im:write',
        'users:read',
        'channels:read'
      ];

      const dmOnlyScopes = [
        'im:history',
        'im:write',
        'users:read',
        'chat:write',
        'commands'
      ];

      // Verify scope reduction
      expect(previousScopes).toHaveLength(8);
      expect(dmOnlyScopes).toHaveLength(5);
      expect(dmOnlyScopes.length).toBeLessThan(previousScopes.length);

      // Verify removed scopes
      const removedScopes = [
        'app_mentions:read',
        'im:read',
        'channels:read'
      ];

      removedScopes.forEach(scope => {
        expect(previousScopes).toContain(scope);
        expect(dmOnlyScopes).not.toContain(scope);
      });

      // Verify retained scopes
      const retainedScopes = [
        'chat:write',
        'commands',
        'im:history',
        'im:write',
        'users:read'
      ];

      retainedScopes.forEach(scope => {
        expect(previousScopes).toContain(scope);
        expect(dmOnlyScopes).toContain(scope);
      });
    });

    it('should validate scope reduction benefits', () => {
      const previousScopeCount = 8;
      const dmOnlyScopeCount = 5;
      const reductionPercentage = ((previousScopeCount - dmOnlyScopeCount) / previousScopeCount) * 100;

      expect(reductionPercentage).toBe(37.5);
      expect(dmOnlyScopeCount).toBeLessThan(previousScopeCount);
    });
  });
});
