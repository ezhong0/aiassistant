import { Application } from 'express';
import swaggerUi from 'swagger-ui-express';

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'AI Assistant Application API',
    version: '1.0.0',
    description: `
      AI-powered assistant application that orchestrates multiple domain-specific services 
      (Email, Calendar, Contacts, Slack) through an intelligent agent system.
      
      ## Features
      - Multi-agent AI system with specialized agents for different domains
      - OAuth 2.0 authentication with Google and Slack
      - Secure token management with encryption
      - Rate limiting and security middleware
      - Comprehensive error tracking and monitoring
      
      ## Authentication
      This API uses OAuth 2.0 for authentication. Most endpoints require a valid JWT token
      obtained through the OAuth flow.
    `,
    contact: {
      name: 'API Support',
      email: 'support@assistantapp.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
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
        description: 'Returns the health status of the application and all services',
        tags: ['Health'],
        responses: {
          '200': {
            description: 'Application is healthy',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthStatus',
                },
                examples: {
                  healthy: {
                    summary: 'Healthy application',
                    value: {
                      status: 'healthy',
                      timestamp: '2024-01-15T10:30:00Z',
                      services: {
                        database: { status: 'healthy' },
                        cache: { status: 'healthy' },
                        encryption: { status: 'healthy' },
                      },
                      version: '1.0.0',
                    },
                  },
                },
              },
            },
          },
          '503': {
            description: 'Application is unhealthy',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthStatus',
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
        description: 'Initiates Google OAuth authentication flow. Redirects user to Google for authentication.',
        tags: ['Authentication'],
        parameters: [
          {
            name: 'state',
            in: 'query',
            description: 'Optional state parameter for CSRF protection',
            required: false,
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '302': {
            description: 'Redirects to Google OAuth authorization page',
            headers: {
              'Location': {
                description: 'Google OAuth authorization URL',
                schema: {
                  type: 'string',
                },
              },
            },
          },
          '400': {
            description: 'Invalid request parameters',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
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
        description: 'Validates the current access token and returns user information',
        tags: ['Authentication'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Token is valid',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TokenValidation',
                },
                examples: {
                  valid: {
                    summary: 'Valid token',
                    value: {
                      valid: true,
                      user: {
                        userId: 'user_123456',
                        email: 'user@example.com',
                        name: 'John Doe',
                      },
                      expiresAt: '2024-01-15T11:30:00Z',
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Invalid or expired token',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
                examples: {
                  invalid: {
                    summary: 'Invalid token',
                    value: {
                      success: false,
                      error: {
                        code: 'INVALID_TOKEN',
                        message: 'Token is invalid or expired',
                      },
                    },
                  },
                },
              },
            },
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
        description: 'JWT token obtained through OAuth flow',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          error: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                example: 'VALIDATION_ERROR',
              },
              message: {
                type: 'string',
                example: 'Invalid request parameters',
              },
              details: {
                type: 'object',
                description: 'Additional error details',
              },
            },
          },
        },
      },
      HealthStatus: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['healthy', 'unhealthy', 'degraded'],
            example: 'healthy',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00Z',
          },
          services: {
            type: 'object',
            description: 'Status of individual services',
          },
          version: {
            type: 'string',
            example: '1.0.0',
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            example: 'user_123456',
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'user@example.com',
          },
          name: {
            type: 'string',
            example: 'John Doe',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      TokenValidation: {
        type: 'object',
        properties: {
          valid: {
            type: 'boolean',
            example: true,
          },
          user: {
            $ref: '#/components/schemas/User',
          },
          expiresAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
  tags: [
    {
      name: 'Health',
      description: 'Health check endpoints',
    },
    {
      name: 'Authentication',
      description: 'OAuth authentication endpoints',
    },
    {
      name: 'Protected',
      description: 'Protected endpoints requiring authentication',
    },
    {
      name: 'Slack',
      description: 'Slack integration endpoints',
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
    
    // Swagger UI available at /docs
  }
}
