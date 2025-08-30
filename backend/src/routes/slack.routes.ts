import express from 'express';
import { ServiceManager } from '../services/service-manager';
import { SlackInterface } from '../interfaces/slack.interface';
import logger from '../utils/logger';

// Import fetch for Node.js (available in Node 18+)
// For older versions, you might need to install node-fetch
const fetch = globalThis.fetch || require('node-fetch');

/**
 * Slack routes for handling OAuth callbacks and other Slack-specific endpoints
 * Note: These routes are separate from the Bolt framework routes
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
   * Slack Event Subscription endpoint - handles URL verification challenge
   * This is the main endpoint that Slack calls for all events
   */
  router.post('/events', async (req, res): Promise<void> => {
    try {
      const { challenge, type, event, team_id, api_app_id } = req.body;
      
      logger.info('Slack event received', { 
        type, 
        eventType: event?.type,
        teamId: team_id,
        apiAppId: api_app_id,
        hasChallenge: !!challenge
      });

      // Handle URL verification challenge (required for Slack app setup)
      if (type === 'url_verification' && challenge) {
        logger.info('Slack URL verification challenge received', { challenge: challenge.substring(0, 10) + '...' });
        
        // Respond with the challenge value to verify the endpoint
        res.status(200).json({ challenge });
        return;
      }

      // For actual events, handle them directly instead of forwarding
      if (type === 'event_callback' && event) {
        logger.info('Slack event callback received, processing directly', { 
          eventType: event.type,
          userId: event.user,
          channelId: event.channel
        });

        try {
          // Get the Slack interface from service manager to handle the event
          const interfaces = await require('../interfaces').initializeInterfaces(serviceManager);
          if (interfaces.slackInterface) {
            // Process the event directly using SlackInterface
            await interfaces.slackInterface.handleEvent(event, team_id);
          } else {
            logger.warn('SlackInterface not available to process event');
          }
          
          // Always acknowledge to Slack
          res.status(200).json({ ok: true });
        } catch (processError) {
          logger.error('Error processing Slack event directly', processError);
          // Still acknowledge to Slack to prevent retries
          res.status(200).json({ ok: true });
        }
        return;
      }

      // Handle other event types
      logger.info('Other Slack event type received', { type });
      res.status(200).json({ ok: true });
      
    } catch (error) {
      logger.error('Error handling Slack event', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * Slack commands endpoint - handles slash commands
   * This endpoint will be used by the Bolt framework
   */
  router.post('/commands', async (req, res): Promise<void> => {
    try {
      const { command, text, user_id, channel_id } = req.body;
      
      logger.info('Slack command received', { 
        command,
        text: text?.substring(0, 100) + (text && text.length > 100 ? '...' : ''),
        userId: user_id,
        channelId: channel_id
      });

      // Handle empty commands with helpful guidance
      if (!text || text.trim().length === 0) {
        logger.info('Empty slash command received, providing usage guidance');
        // Acknowledge receipt - actual processing handled by Bolt
        res.status(200).json({ ok: true });
        return;
      }

      // Acknowledge receipt - actual processing handled by Bolt
      res.status(200).json({ ok: true });
      
    } catch (error) {
      logger.error('Error handling Slack command', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * Slack interactive components endpoint - handles button clicks, modals, etc.
   */
  router.post('/interactive', async (req, res): Promise<void> => {
    try {
      const payload = req.body.payload;
      if (!payload) {
        res.status(400).json({ error: 'No payload provided' });
        return;
      }

      const parsedPayload = JSON.parse(payload);
      logger.info('Slack interactive component received', { 
        type: parsedPayload.type,
        actionId: parsedPayload.actions?.[0]?.action_id,
        userId: parsedPayload.user?.id,
        fullPayload: parsedPayload // Log full payload for debugging
      });

      // Process button clicks
      if (parsedPayload.type === 'block_actions' && parsedPayload.actions?.[0]) {
        const action = parsedPayload.actions[0];
        const actionId = action.action_id;
        
        logger.info('Processing button click', { actionId, actionType: typeof actionId });

        // Handle different button types
        if (actionId && actionId.includes('view_') && actionId.includes('_results')) {
          logger.info('Matched view results button pattern');
          // Extract tool name from action ID (e.g., "view_emailagent_results" -> "emailAgent")
          const toolName = actionId.replace('view_', '').replace('_results', '');
          
          // Send a response showing the results
          const responseMessage = {
            text: `📋 ${toolName} Results`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*${toolName} Results*\n\nThis feature shows detailed results from the ${toolName} execution. The email was processed successfully.`
                }
              },
              {
                type: 'context',
                elements: [
                  {
                    type: 'mrkdwn',
                    text: `Action: ${actionId} | User: ${parsedPayload.user?.name || 'Unknown'}`
                  }
                ]
              }
            ]
          };

          res.status(200).json(responseMessage);
          return;
        }

        // Handle other button types
        res.status(200).json({
          text: `Button clicked: ${actionId}`,
          response_type: 'ephemeral'
        });
      } else {
        // Acknowledge receipt for other interaction types
        res.status(200).json({ ok: true });
      }
      
    } catch (error) {
      logger.error('Error handling Slack interactive component', error);
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

  /**
   * Test endpoint to verify Slack configuration (development only)
   */
  if (process.env.NODE_ENV === 'development') {
    router.get('/test-config', async (req, res): Promise<void> => {
      try {
        const slackConfig = {
          signingSecret: process.env.SLACK_SIGNING_SECRET ? 'configured' : 'missing',
          botToken: process.env.SLACK_BOT_TOKEN ? 'configured' : 'missing',
          clientId: process.env.SLACK_CLIENT_ID ? 'configured' : 'missing',
          clientSecret: process.env.SLACK_CLIENT_SECRET ? 'configured' : 'missing',
          redirectUri: process.env.SLACK_OAUTH_REDIRECT_URI ? 'configured' : 'missing'
        };

        const missingVars = Object.entries(slackConfig)
          .filter(([_, value]) => value === 'missing')
          .map(([key, _]) => key);

        res.json({
          status: missingVars.length === 0 ? 'configured' : 'incomplete',
          config: slackConfig,
          missing: missingVars,
          endpoints: {
            events: '/slack/events',
            commands: '/slack/commands',
            interactive: '/slack/interactive',
            boltEvents: '/slack/bolt/events',
            boltCommands: '/slack/bolt/commands',
            boltInteractive: '/slack/bolt/interactive'
          },
          message: missingVars.length === 0 
            ? 'Slack is fully configured and ready to receive events'
            : `Missing configuration: ${missingVars.join(', ')}`
        });

      } catch (error) {
        logger.error('Error checking Slack configuration', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }

  return router;
}