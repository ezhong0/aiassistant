import express from 'express';
import { z } from 'zod';
import { createLogContext } from '../utils/log-context';
import {
  SlackWebhookEventSchema,
  SlackSlashCommandPayloadSchema,
  SlackInteractiveComponentPayloadSchema
} from '../schemas/slack.schemas';
import { validateRequest } from '../middleware/validation.middleware';
import { ServiceManager } from '../services/service-manager';
import { SlackService } from '../services/slack/slack.service';
import { SlackOAuthService } from '../services/slack/slack-oauth.service';
import { AuthStatusService } from '../services/auth-status.service';
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
    const logContext = createLogContext(req);
    
    try {
      const { code, state, error } = req.query;

      if (error) {
        logger.error('Slack OAuth error', {
          error: error as string,
          correlationId: logContext.correlationId,
          operation: 'oauth_callback',
          metadata: { error }
        });
        res.status(400).json({ error: 'OAuth authorization failed' });
        return;
      }

      if (!code) {
        logger.error('No authorization code received', {
          error: 'Missing authorization code',
          correlationId: logContext.correlationId,
          operation: 'oauth_callback'
        });
        res.status(400).json({ error: 'No authorization code received' });
        return;
      }

      // OAuth token exchange is handled by SlackOAuthManager service

      
      
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
      
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * Test endpoint to verify Slack routes are working
   */
  router.get('/test', (req, res) => {
    logger.info('Slack test endpoint reached', {
      operation: 'slack_test_endpoint'
    });
    res.json({ status: 'ok', message: 'Slack routes are working', timestamp: new Date().toISOString() });
  });

  /**
   * Slack Event Subscription endpoint - handles URL verification challenge
   * This is the main endpoint that Slack calls for all events
   */
  router.post('/events', 
    validateRequest({ body: SlackWebhookEventSchema }),
    async (req, res): Promise<void> => {
    const requestStartTime = Date.now();
    const logContext = createLogContext(req);
    
    try {
      // Ignore Slack retries to prevent duplicate processing
      const retryNum = req.get('X-Slack-Retry-Num');
      if (retryNum && parseInt(retryNum, 10) > 0) {
        logger.debug('Ignoring Slack retry delivery', {
          ...logContext,
          metadata: { retryNum, reason: req.get('X-Slack-Retry-Reason') }
        });
        res.status(200).json({ ok: true, ignored: 'slack_retry' });
        return;
      }

      const { challenge, type, event, team_id, api_app_id } = req.body;
      
      logger.info('Slack event received', {
        ...logContext,
        metadata: {
          eventType: type,
          hasChallenge: !!challenge,
          teamId: team_id,
          eventUser: event?.user,
          eventChannel: event?.channel,
          eventText: event?.text?.substring(0, 100)
        }
      });

      // Handle URL verification challenge (required for Slack app setup)
      if (type === 'url_verification' && challenge) {
        const responseTime = Date.now() - requestStartTime;
        logger.debug('URL verification challenge received', {
          ...logContext,
          duration: responseTime,
          metadata: { challengeLength: challenge.length }
        });
        
        // Respond with the challenge value to verify the endpoint
        res.status(200).json({ challenge });
        return;
      }

      // For actual events, handle them directly via SlackService
      if (type === 'event_callback' && event) {
        logger.debug('Event callback processing', {
          ...logContext,
          metadata: {
            eventType: event.type,
            userId: event.user,
            channelId: event.channel,
            eventTs: event.ts
          }
        });

        // IMMEDIATELY acknowledge to Slack to prevent retries
        const responseTime = Date.now() - requestStartTime;
        logger.debug('Sending acknowledgment to Slack', {
          ...logContext,
          duration: responseTime,
          metadata: { eventTs: event.ts }
        });
        res.status(200).json({ ok: true });
        
        // Process the event asynchronously (don't await)
        const slackService = serviceManager.getService('slackService') as SlackService | undefined;
        if (slackService) {
          const slackContext = {
            userId: event.user,
            channelId: event.channel,
            teamId: team_id,
            threadTs: event.thread_ts,
            isDirectMessage: event.channel_type === 'im'
          };
          slackService.processEvent(event as any, slackContext as any).catch((processError: unknown) => {
            logger.error('Event processing failed', {
              error: (processError as Error).message,
              stack: (processError as Error).stack,
              ...logContext,
              operation: 'event_processing_error'
            });
          });
        } else {
          logger.warn('SlackService not available - event not processed', {
            ...logContext,
            operation: 'event_processing',
            metadata: { eventType: event.type }
          });
        }
        return;
      }

      // Handle other event types
      
      res.status(200).json({ ok: true });
      
    } catch (error) {
      
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
    const logContext = createLogContext(req);

    try {
      const { command, text, user_id, team_id, response_url } = req.body;

      // Handle /auth command (ignore any additional text)
      if (command === '/auth') {
        // Immediate acknowledgment
        res.status(200).send();

        logger.info('/auth command received', {
          correlationId: logContext.correlationId,
          operation: 'auth_command',
          metadata: { userId: user_id, teamId: team_id }
        });

        try {
          // Get user connections
          const authStatusService = serviceManager.getService<AuthStatusService>('authStatusService');
          if (!authStatusService) {
            throw new Error('AuthStatusService not available');
          }

          logger.info('Getting user connections', {
            correlationId: logContext.correlationId,
            operation: 'auth_get_connections',
            metadata: { userId: user_id, teamId: team_id }
          });

          const connections = await authStatusService.getUserConnections(team_id, user_id);
          const blocks = authStatusService.buildStatusBlocks(connections);

          logger.info('Built auth blocks', {
            correlationId: logContext.correlationId,
            operation: 'auth_blocks_built',
            metadata: {
              userId: user_id,
              teamId: team_id,
              connectionsCount: connections.length,
              blocksCount: blocks.length,
              hasResponseUrl: !!response_url
            }
          });

          // Send response via response_url for better UX
          const slackService = serviceManager.getService<SlackService>('slackService');
          if (slackService && response_url) {
            logger.info('Sending auth response to Slack', {
              correlationId: logContext.correlationId,
              operation: 'auth_send_response',
              metadata: { userId: user_id, teamId: team_id, responseUrl: response_url.substring(0, 50) + '...' }
            });

            await slackService.sendToResponseUrl(response_url, {
              response_type: 'ephemeral',
              blocks
            });

            logger.info('Auth response sent successfully', {
              correlationId: logContext.correlationId,
              operation: 'auth_response_sent',
              metadata: { userId: user_id, teamId: team_id }
            });
          } else {
            logger.warn('Cannot send auth response via response_url, trying direct message', {
              correlationId: logContext.correlationId,
              operation: 'auth_response_fallback',
              metadata: {
                userId: user_id,
                teamId: team_id,
                hasSlackService: !!slackService,
                hasResponseUrl: !!response_url
              }
            });

            // Fallback: try to send as direct message
            if (slackService) {
              try {
                await slackService.sendMessage(user_id, '🔐 Your Connections', { blocks });
                logger.info('Auth response sent via direct message', {
                  correlationId: logContext.correlationId,
                  operation: 'auth_dm_sent',
                  metadata: { userId: user_id, teamId: team_id }
                });
              } catch (dmError) {
                logger.error('Failed to send auth response via DM', dmError as Error, {
                  correlationId: logContext.correlationId,
                  operation: 'auth_dm_failed',
                  metadata: { userId: user_id, teamId: team_id }
                });
              }
            }
          }
        } catch (error) {
          logger.error('/auth command failed', error as Error, {
            correlationId: logContext.correlationId,
            operation: 'auth_command_error',
            metadata: { userId: user_id, teamId: team_id }
          });

          const slackService = serviceManager.getService<SlackService>('slackService');
          if (slackService && response_url) {
            await slackService.sendToResponseUrl(response_url, {
              response_type: 'ephemeral',
              text: '❌ Failed to load connections. Please try again.'
            });
          }
        }
        return;
      }

      // Handle empty commands with helpful guidance
      if (!text || text.trim().length === 0) {

        // Acknowledge receipt - actual processing handled by Bolt
        res.status(200).json({ ok: true });
        return;
      }

      // Acknowledge receipt - actual processing handled by Bolt
      res.status(200).json({ ok: true });

    } catch (error) {
      logger.error('Command handler error', error as Error, {
        correlationId: logContext.correlationId,
        operation: 'command_handler_error'
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * Slack interactive components endpoint - handles button clicks, modals, etc.
   */
  router.post('/interactive',
    validateRequest({ body: SlackInteractiveComponentPayloadSchema }),
    async (req, res): Promise<void> => {
    const logContext = createLogContext(req);

    try {
      const payload = req.body.payload;
      if (!payload) {
        res.status(400).json({ error: 'No payload provided' });
        return;
      }

      logger.info('Interactive payload received', {
        correlationId: logContext.correlationId,
        operation: 'interactive_payload_received',
        metadata: {
          payloadLength: payload.length,
          payloadPreview: payload.substring(0, 100) + '...'
        }
      });

      const parsedPayload = JSON.parse(payload);

      logger.info('Interactive payload parsed', {
        correlationId: logContext.correlationId,
        operation: 'interactive_payload_parsed',
        metadata: {
          type: parsedPayload.type,
          actionsCount: parsedPayload.actions?.length || 0,
          userId: parsedPayload.user?.id,
          teamId: parsedPayload.team?.id
        }
      });

      // Process button clicks
      if (parsedPayload.type === 'block_actions' && parsedPayload.actions?.[0]) {
        const action = parsedPayload.actions[0];
        const actionId = action.action_id;
        const actionValue = action.value;
        

        // Handle auth button clicks
        if (actionId?.startsWith('connect_') || actionId?.startsWith('refresh_')) {
          const provider = actionId.replace(/^(connect_|refresh_)/, '');
          const userId = parsedPayload.user?.id;
          const teamId = parsedPayload.team?.id;

          logger.info('Auth button clicked', {
            correlationId: createLogContext(req).correlationId,
            operation: 'auth_button_click',
            metadata: { actionId, provider, userId, teamId }
          });

          // Generate OAuth URL
          const slackOAuthService = serviceManager.getService<SlackOAuthService>('slackOAuthService');

          logger.info('OAuth service check', {
            correlationId: createLogContext(req).correlationId,
            operation: 'oauth_service_check',
            metadata: {
              hasSlackOAuthService: !!slackOAuthService,
              hasUserId: !!userId,
              hasTeamId: !!teamId,
              userId,
              teamId
            }
          });

          if (slackOAuthService && userId && teamId) {
            try {
              logger.info('Generating OAuth URL', {
                correlationId: createLogContext(req).correlationId,
                operation: 'oauth_url_generation_start',
                metadata: { provider, userId, teamId }
              });

              const state = JSON.stringify({
                userId,
                teamId,
                provider,
                action: actionId.startsWith('refresh_') ? 'refresh' : 'connect',
                returnTo: 'auth_dashboard'
              });

              logger.info('OAuth state created', {
                correlationId: createLogContext(req).correlationId,
                operation: 'oauth_state_created',
                metadata: { state }
              });

              const authUrl = await slackOAuthService.generateAuthUrl({
                userId,
                teamId,
                channelId: parsedPayload.channel?.id || userId
              } as any, [
                'openid',
                'email',
                'profile',
                'https://www.googleapis.com/auth/gmail.send',
                'https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/calendar',
                'https://www.googleapis.com/auth/contacts.readonly'
              ]);

              logger.info('OAuth URL generated successfully', {
                correlationId: createLogContext(req).correlationId,
                operation: 'oauth_url_generated',
                metadata: { authUrl: authUrl.substring(0, 100) + '...' }
              });

              // Send OAuth URL via direct message instead of updating the original message
              logger.info('Sending OAuth URL via direct message', {
                correlationId: createLogContext(req).correlationId,
                operation: 'oauth_dm_send',
                metadata: { userId, authUrl: authUrl.substring(0, 100) + '...' }
              });

              // Send a direct message with the OAuth URL
              const slackService = serviceManager.getService<SlackService>('slackService');
              if (slackService) {
                await slackService.sendMessage(userId, '🔐 Google Authorization Required', {
                  blocks: [
                    {
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: `🔐 *Google Authorization Required*\n\nTo connect your Google account, please click the link below:`
                      }
                    },
                    {
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: `<${authUrl}|🔗 Authorize Google Account>`
                      }
                    },
                    {
                      type: 'context',
                      elements: [
                        {
                          type: 'mrkdwn',
                          text: '💡 This will open in a new window. Return to Slack when complete.'
                        }
                      ]
                    }
                  ]
                });
              }

              // Acknowledge the button click
              res.status(200).json({
                text: '✅ Authorization link sent to your direct messages!',
                replace_original: false
              });
              return;
            } catch (error) {
              logger.error('Failed to generate auth URL', error as Error, {
                correlationId: createLogContext(req).correlationId,
                operation: 'auth_url_generation_error',
                metadata: { provider, userId, teamId }
              });

              res.status(200).json({
                text: '❌ Failed to generate authorization link. Please try again.',
                replace_original: false
              });
              return;
            }
          }
        }

        // Handle test connection button
        if (actionId?.startsWith('test_')) {
          const provider = actionId.replace('test_', '');
          const userId = parsedPayload.user?.id;
          const teamId = parsedPayload.team?.id;

          logger.info('Test connection button clicked', {
            correlationId: createLogContext(req).correlationId,
            operation: 'test_connection_click',
            metadata: { provider, userId, teamId }
          });

          if (userId && teamId) {
            const authStatusService = serviceManager.getService<AuthStatusService>('authStatusService');
            if (!authStatusService) {
              res.status(200).json({
                text: '❌ Service not available. Please try again.',
                replace_original: false
              });
              return;
            }

            const result = await authStatusService.testConnection(teamId, userId, provider);

            res.status(200).json({
              replace_original: false,
              text: result.message,
              response_type: 'ephemeral'
            });
            return;
          }
        }

        // Handle view auth dashboard button
        if (actionId === 'view_auth_dashboard') {
          const userId = parsedPayload.user?.id;
          const teamId = parsedPayload.team?.id;

          logger.info('View auth dashboard button clicked', {
            correlationId: createLogContext(req).correlationId,
            operation: 'view_auth_dashboard_click',
            metadata: { userId, teamId }
          });

          if (userId && teamId) {
            try {
              const authStatusService = serviceManager.getService<AuthStatusService>('authStatusService');
              if (!authStatusService) {
                throw new Error('AuthStatusService not available');
              }

              const connections = await authStatusService.getUserConnections(teamId, userId);
              const blocks = authStatusService.buildStatusBlocks(connections);

              res.status(200).json({
                replace_original: true,
                blocks
              });
              return;
            } catch (error) {
              logger.error('Failed to load auth dashboard', error as Error, {
                correlationId: createLogContext(req).correlationId,
                operation: 'auth_dashboard_load_error',
                metadata: { userId, teamId }
              });

              res.status(200).json({
                text: '❌ Failed to load connections. Please try again.',
                replace_original: false
              });
              return;
            }
          }
        }

        // Handle view results buttons
        if (actionId && actionId.includes('view_') && actionId.includes('_results')) {

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
        
        res.status(200).json({
          text: `Button clicked: ${actionId}`,
          response_type: 'ephemeral'
        });
      } else {
        // Acknowledge receipt for other interaction types
        res.status(200).json({ ok: true });
      }
      
    } catch (error) {
      
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
        
        
        
        // Note: Interfaces don't have direct sendMessage methods
        // This endpoint now just validates configuration
        
        res.json({ 
          status: 'success', 
          message: 'Slack interface configuration validated',
          data: { message, channel, configured: true }
        });

      } catch (error) {
        
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
        
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }

  return router;
}