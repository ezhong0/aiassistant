import express from 'express';
import { ServiceManager } from '../services/service-manager';
import { SlackInterface } from '../interfaces/slack.interface';
import logger from '../utils/logger';

/**
 * Slack routes for handling OAuth callbacks and other Slack-specific endpoints
 */
export function createSlackRoutes(serviceManager: ServiceManager): express.Router {
  const router = express.Router();

  /**
   * Slack OAuth callback handler
   */
  router.get('/oauth/callback', async (req, res): Promise<void> => {
    try {
      const { code, state, error } = req.query;

      if (error) {
        logger.error('Slack OAuth error', { error });
        res.status(400).json({ error: 'OAuth authorization failed' });
        return;
      }

      if (!code) {
        logger.error('No authorization code received');
        res.status(400).json({ error: 'No authorization code received' });
        return;
      }

      // TODO: Implement OAuth token exchange
      // This will be implemented when we add the full OAuth flow

      logger.info('Slack OAuth callback received', { code: typeof code, state });
      
      res.send(`
        <html>
          <head><title>Slack Installation</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>🎉 Installation Successful!</h1>
            <p>AI Assistant has been successfully installed to your Slack workspace.</p>
            <p>You can now use the <code>/assistant</code> command or mention <code>@AI Assistant</code> in any channel.</p>
            <p>You can close this tab and return to Slack.</p>
          </body>
        </html>
      `);

    } catch (error) {
      logger.error('Error in Slack OAuth callback', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * Slack app installation page
   */
  router.get('/install', async (req, res): Promise<void> => {
    try {
      // TODO: Replace with actual Slack app client ID
      const clientId = process.env.SLACK_CLIENT_ID;
      const redirectUri = process.env.SLACK_OAUTH_REDIRECT_URI;

      if (!clientId || !redirectUri) {
        res.status(500).json({ error: 'Slack app configuration missing' });
        return;
      }

      const scopes = [
        'app_mentions:read',
        'chat:write',
        'commands',
        'im:history',
        'im:read',
        'im:write',
        'users:read',
        'channels:read'
      ].join(',');

      const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`;

      res.send(`
        <html>
          <head><title>Install AI Assistant</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>🤖 AI Assistant for Slack</h1>
            <p>Install AI Assistant to your Slack workspace to get help with:</p>
            <ul style="text-align: left; max-width: 400px; margin: 20px auto;">
              <li>📧 Email management</li>
              <li>📅 Calendar scheduling</li>
              <li>👤 Contact lookup</li>
              <li>🤖 Intelligent task assistance</li>
            </ul>
            <a href="${slackAuthUrl}" style="display: inline-block; background: #4A154B; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px;">
              Add to Slack
            </a>
          </body>
        </html>
      `);

    } catch (error) {
      logger.error('Error serving Slack install page', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * Health check for Slack integration
   */
  router.get('/health', async (req, res): Promise<void> => {
    try {
      // Check if Slack interface is configured
      const isSlackConfigured = process.env.SLACK_SIGNING_SECRET && 
                               process.env.SLACK_BOT_TOKEN && 
                               process.env.SLACK_CLIENT_ID;
      
      if (!isSlackConfigured) {
        res.status(503).json({ 
          status: 'error', 
          message: 'Slack interface not configured' 
        });
        return;
      }
      
      res.json({
        status: 'healthy',
        service: 'SlackInterface',
        details: {
          configured: true,
          message: 'Slack interface is properly configured and ready'
        }
      });

    } catch (error) {
      logger.error('Error checking Slack interface health', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * Webhook verification endpoint (for initial Slack app setup)
   */
  router.post('/events/verify', async (req, res): Promise<void> => {
    try {
      const { challenge, type } = req.body;
      
      if (type === 'url_verification') {
        logger.info('Slack URL verification challenge received');
        res.json({ challenge });
        return;
      }
      
      res.status(200).json({ status: 'ok' });
      
    } catch (error) {
      logger.error('Error handling Slack verification', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * Manual event testing endpoint (development only)
   */
  if (process.env.NODE_ENV === 'development') {
    router.post('/test-event', async (req, res): Promise<void> => {
      try {
        // Check if Slack interface is configured
        const isSlackConfigured = process.env.SLACK_SIGNING_SECRET && 
                                 process.env.SLACK_BOT_TOKEN && 
                                 process.env.SLACK_CLIENT_ID;
        
        if (!isSlackConfigured) {
          res.status(503).json({ error: 'Slack interface not configured' });
          return;
        }

        const { message = 'test message', channel = 'test' } = req.body;
        
        logger.info('Testing Slack interface with manual event', { message, channel });
        
        // Note: Interfaces don't have direct sendMessage methods
        // This endpoint now just validates configuration
        
        res.json({ 
          status: 'success', 
          message: 'Slack interface configuration validated',
          data: { message, channel, configured: true }
        });

      } catch (error) {
        logger.error('Error processing test event', error);
        res.status(500).json({ error: 'Test event failed' });
      }
    });
  }

  return router;
}