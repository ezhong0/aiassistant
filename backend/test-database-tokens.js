const { initializeAllCoreServices } = require('./dist/services/service-initialization');
const { serviceManager } = require('./dist/services/service-manager');

async function testDatabaseTokens() {
  try {
    console.log('🔍 Testing database token retrieval...');

    // Set the Railway database URL
    process.env.DATABASE_URL = 'postgresql://postgres:LGdfoNzzLPFWGpgofUejhpiEpbDNRXzk@postgres.railway.internal:5432/railway';

    // Initialize all core services
    await initializeAllCoreServices();

    const tokenManager = serviceManager.getService('tokenManager');
    const databaseService = serviceManager.getService('databaseService');

    if (!tokenManager || !databaseService) {
      console.error('❌ Services not available');
      return;
    }

    const userId = 'T09CAEM8EVA:U09CAEM99DJ';
    console.log(`🔍 Checking tokens for userId: ${userId}`);

    // Check raw database query
    console.log('\n📊 Raw database query:');
    const query = `
      SELECT user_id,
        google_access_token, google_refresh_token, google_expires_at, google_token_type, google_scope,
        slack_access_token, slack_team_id, slack_user_id,
        created_at, updated_at
      FROM user_tokens
      WHERE user_id = $1
    `;

    const result = await databaseService.query(query, [userId]);
    console.log('📊 Raw query result:', {
      rowCount: result.rows.length,
      hasRows: result.rows.length > 0
    });

    if (result.rows.length > 0) {
      const row = result.rows[0];
      console.log('📊 Raw row data:', {
        userId: row.user_id,
        hasGoogleAccessToken: !!row.google_access_token,
        hasSlackAccessToken: !!row.slack_access_token,
        slackTeamId: row.slack_team_id,
        slackUserId: row.slack_user_id,
        googleAccessTokenLength: row.google_access_token ? row.google_access_token.length : 0,
        slackAccessTokenLength: row.slack_access_token ? row.slack_access_token.length : 0
      });
    }

    // Check TokenManager.getUserTokens
    console.log('\n🔍 TokenManager.getUserTokens:');
    const tokens = await tokenManager.getUserTokens(userId);
    console.log('🔍 TokenManager result:', {
      hasTokens: !!tokens,
      hasGoogleTokens: !!tokens?.googleTokens,
      hasSlackTokens: !!tokens?.slackTokens,
      slackAccessToken: tokens?.slackTokens?.access_token ? 'EXISTS' : 'MISSING'
    });

    if (tokens?.slackTokens) {
      console.log('🔍 Slack tokens structure:', {
        hasAccessToken: !!tokens.slackTokens.access_token,
        teamId: tokens.slackTokens.team_id,
        userId: tokens.slackTokens.user_id,
        accessTokenLength: tokens.slackTokens.access_token ? tokens.slackTokens.access_token.length : 0
      });
    }

    // Test SlackOAuthManager.getValidTokens
    console.log('\n🔍 SlackOAuthManager.getValidTokens:');
    const slackOAuthManager = serviceManager.getService('slackOAuthManager');
    if (slackOAuthManager) {
      const validToken = await slackOAuthManager.getValidTokens(userId);
      console.log('🔍 SlackOAuthManager result:', {
        hasValidToken: !!validToken,
        tokenLength: validToken ? validToken.length : 0
      });
    } else {
      console.log('❌ SlackOAuthManager not available');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

testDatabaseTokens();