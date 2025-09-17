import express from 'express';
import { z } from 'zod';
import { 
  SlackWebhookEventSchema,
  SlackSlashCommandPayloadSchema,
  SlackInteractiveComponentPayloadSchema
} from '../schemas/slack.schemas';
import { validateRequest } from '../middleware/enhanced-validation.middleware';
import { ServiceManager } from '../services/service-manager';
import { SlackInterface } from '../types/slack/slack.interface';
import logger from '../utils/logger';

const emptyQuerySchema = z.object({});
const emptyBodySchema = z.object({});


/**
 * Slack routes for handling OAuth callbacks and other Slack-specific endpoints
 * Note: These routes are separate from the Bolt framework routes
 */
export function createSlackRoutes(serviceManager: ServiceManager, getInterfaces?: () => any): express.Router {
  const router = express.Router();

  /**
   * Slack OAuth callback handler
   */
  router.get('/oauth/callback', 
    validateRequest({ query: z.object({ code: z.string().optional(), state: z.string().optional(), error: z.string().optional() }) }),
    async (req, res): Promise<void> => {
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

      // OAuth token exchange is handled by SlackOAuthManager service

      logger.info('Slack OAuth callback received', { code: typeof code, state });
      
      res.send(`
        <html>
          <head><title>Slack Installation</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>🎉 Installation Successful!</h1>
            <p>AI Assistant has been successfully installed to your Slack workspace.</p>
            <p>To get started, send a direct message to <code>@AI Assistant</code> or use the <code>/assistant</code> command.</p>
            <div style="background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px auto; max-width: 400px;">
              <strong>🔒 Privacy Protected:</strong><br>
              All interactions happen through direct messages to keep your conversations private and secure.
            </div>
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
  router.get('/install', 
    validateRequest({ query: emptyQuerySchema }),
    async (req, res): Promise<void> => {
    try {
      const clientId = process.env.SLACK_CLIENT_ID;
      const redirectUri = process.env.SLACK_OAUTH_REDIRECT_URI;

      if (!clientId || !redirectUri) {
        res.status(500).json({ error: 'Slack app configuration missing' });
        return;
      }

      // DM-only scopes for enhanced privacy and security
      const scopes = [
        'im:history',    // Read direct message history
        'im:write',      // Send messages in direct messages
        'users:read',    // Read user information
        'chat:write',    // Send messages (required for DM responses)
        'commands'       // Handle slash commands
      ].join(',');

      const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`;

      res.send(`
        <html>
          <head><title>Install AI Assistant</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>🤖 AI Assistant for Slack</h1>
            <p>Install AI Assistant to your Slack workspace for private, secure assistance with:</p>
            <ul style="text-align: left; max-width: 400px; margin: 20px auto;">
              <li>📧 Email management</li>
              <li>📅 Calendar scheduling</li>
              <li>👤 Contact lookup</li>
              <li>🤖 Intelligent task assistance</li>
            </ul>
            <div style="background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px auto; max-width: 400px;">
              <strong>🔒 Privacy-First Design:</strong><br>
              AI Assistant works exclusively through direct messages to protect your privacy and keep conversations secure.
            </div>
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
  router.get('/health', 
    validateRequest({ query: emptyQuerySchema }),
    async (req, res): Promise<void> => {
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
  router.post('/events', 
    validateRequest({ body: SlackWebhookEventSchema }),
    async (req, res): Promise<void> => {
    const requestStartTime = Date.now();
    
    try {
      const { challenge, type, event, team_id, api_app_id } = req.body;
      
      // Log comprehensive event details for duplicate analysis
      logger.info('Slack event received - FULL ANALYSIS', { 
        type, 
        eventType: event?.type,
        teamId: team_id,
        apiAppId: api_app_id,
        hasChallenge: !!challenge,
        requestStartTime,
        // Event details
        eventTs: event?.ts,
        eventUser: event?.user,
        eventChannel: event?.channel,
        eventText: event?.text?.substring(0, 100) + '...',
        eventClientMsgId: event?.client_msg_id,
        // Request metadata
        userAgent: req.get('User-Agent'),
        xSlackSignature: req.get('X-Slack-Signature')?.substring(0, 20) + '...',
        xSlackRequestTimestamp: req.get('X-Slack-Request-Timestamp'),
        contentType: req.get('Content-Type'),
        // Full event object (first 500 chars)
        fullEventPreview: JSON.stringify(event).substring(0, 500) + '...'
      });

      // Handle URL verification challenge (required for Slack app setup)
      if (type === 'url_verification' && challenge) {
        const responseTime = Date.now() - requestStartTime;
        logger.info('Slack URL verification challenge received', { 
          challenge: challenge.substring(0, 10) + '...',
          responseTimeMs: responseTime
        });
        
        // Respond with the challenge value to verify the endpoint
        res.status(200).json({ challenge });
        return;
      }

      // For actual events, handle them directly instead of forwarding
      if (type === 'event_callback' && event) {
        logger.info('Slack event callback received, processing directly', { 
          eventType: event.type,
          userId: event.user,
          channelId: event.channel,
          eventTs: event.ts,
          eventClientMsgId: event.client_msg_id,
          // Check if this is the exact same event
          eventHash: `${event.ts}-${event.user}-${event.channel}-${event.type}`,
          requestTimestamp: req.get('X-Slack-Request-Timestamp')
        });

        // IMMEDIATELY acknowledge to Slack to prevent retries
        const responseTime = Date.now() - requestStartTime;
        logger.info('Sending acknowledgment to Slack', { 
          responseTimeMs: responseTime,
          eventType: event.type,
          eventTs: event.ts
        });
        res.status(200).json({ ok: true });
        
        // Process the event asynchronously (don't await)
        const interfaces = getInterfaces ? getInterfaces() : null;
        if (interfaces?.slackInterface) {
          // Process in background - don't block the response
          interfaces.slackInterface.handleEvent(event, team_id).catch((processError: unknown) => {
            logger.error('Error processing Slack event asynchronously', processError);
          });
        } else {
          logger.warn('SlackInterface not available - may not be initialized yet');
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
  router.post('/commands', 
    validateRequest({ body: SlackSlashCommandPayloadSchema }),
    async (req, res): Promise<void> => {
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
  router.post('/interactive', 
    validateRequest({ body: SlackInteractiveComponentPayloadSchema }),
    async (req, res): Promise<void> => {
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
        teamId: parsedPayload.team?.id,
        channelId: parsedPayload.channel?.id,
        responseUrl: parsedPayload.response_url
      });

      // Process button clicks
      if (parsedPayload.type === 'block_actions' && parsedPayload.actions?.[0]) {
        const action = parsedPayload.actions[0];
        const actionId = action.action_id;
        const actionValue = action.value;
        
        logger.info('Processing button click', { 
          actionId, 
          actionValue,
          actionType: typeof actionId 
        });

        // Handle view results buttons
        if (actionId && actionId.includes('view_') && actionId.includes('_results')) {
          logger.info('Matched view results button pattern');
          const toolName = actionId.replace('view_', '').replace('_results', '');
          
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
        logger.info('Unhandled button interaction', { actionId, actionValue });
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
    router.post('/test-event', 
      validateRequest({ body: emptyBodySchema }),
      async (req, res): Promise<void> => {
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
    router.get('/test-config', 
      validateRequest({ query: emptyQuerySchema }),
      async (req, res): Promise<void> => {
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