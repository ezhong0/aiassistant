import { Application } from 'express';
import swaggerUi from 'swagger-ui-express';

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Assistant App API',
    version: '1.0.0',
    description: 'AI-powered assistant application API',
  },
  servers: [
    {
      url: process.env.NODE_ENV === 'production' 
        ? 'https://your-production-domain.com' 
        : 'http://localhost:3000',
      description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
    },
  ],
  paths: {
    '/healthz': {
      get: {
        summary: 'Health check',
        description: 'Returns the health status of the application',
        responses: {
          '200': {
            description: 'Application is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'healthy' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/google': {
      get: {
        summary: 'Google OAuth login',
        description: 'Initiates Google OAuth authentication flow',
        responses: {
          '302': {
            description: 'Redirects to Google OAuth',
          },
        },
      },
    },
    '/auth/callback': {
      get: {
        summary: 'OAuth callback',
        description: 'Handles OAuth callback from Google',
        parameters: [
          {
            name: 'code',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Authorization code from OAuth provider',
          },
          {
            name: 'state',
            in: 'query',
            schema: { type: 'string' },
            description: 'State parameter for CSRF protection',
          },
        ],
        responses: {
          '200': {
            description: 'Authentication successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    accessToken: { type: 'string' },
                    refreshToken: { type: 'string' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid callback parameters',
          },
        },
      },
    },
    '/auth/refresh': {
      post: {
        summary: 'Refresh access token',
        description: 'Refreshes an expired access token using refresh token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  refresh_token: { type: 'string' },
                },
                required: ['refresh_token'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Token refreshed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    accessToken: { type: 'string' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Invalid refresh token',
          },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Logout',
        description: 'Logs out the user and revokes tokens',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  access_token: { type: 'string' },
                  everywhere: { type: 'boolean', default: false },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Logout successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/validate': {
      get: {
        summary: 'Validate token',
        description: 'Validates the current access token',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Token is valid',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    valid: { type: 'boolean' },
                    user: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        email: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Invalid or expired token',
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};

export function setupSwagger(app: Application): void {
  // Only enable Swagger in development or when explicitly enabled
  if (process.env.NODE_ENV === 'development' || process.env.ENABLE_SWAGGER === 'true') {
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Assistant App API Documentation',
    }));
    
    console.log('📚 Swagger UI available at /docs');
  }
}
