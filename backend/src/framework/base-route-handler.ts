/**
 * Base Route Handler
 * Abstract base class for route handlers to eliminate duplication and standardize patterns
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';
import { createLogContext } from '../utils/log-context';
import { AppError, ErrorFactory, ERROR_CATEGORIES } from '../utils/app-error';
import { HTMLTemplates } from '../templates/html-templates';

/**
 * Route handler options
 */
export interface RouteHandlerOptions {
  operation: string;
  requiresAuth?: boolean;
  rateLimit?: boolean;
  successRedirect?: string;
  errorRedirect?: string;
}

/**
 * Standardized route response
 */
export interface RouteResponse {
  success: boolean;
  data?: any;
  message?: string;
  redirect?: string;
  html?: string;
}

/**
 * Abstract base route handler class
 */
export abstract class BaseRouteHandler {
  protected readonly operation: string;
  protected readonly options: RouteHandlerOptions;

  constructor(operation: string, options: Partial<RouteHandlerOptions> = {}) {
    this.operation = operation;
    this.options = {
      operation,
      requiresAuth: false,
      rateLimit: false,
      ...options
    };
  }

  /**
   * Create standardized route handler with error handling
   */
  public createHandler<TQuery = any, TBody = any>(
    handler: (req: Request<any, any, TBody, TQuery>, res: Response) => Promise<RouteResponse>
  ) {
    return async (req: Request<any, any, TBody, TQuery>, res: Response, _next: NextFunction): Promise<void> => {
      const logContext = createLogContext(req, { operation: this.operation });

      try {
        logger.info(`${this.operation} - Request started`, {
          ...logContext,
          metadata: {
            query: req.query,
            params: req.params,
            userAgent: req.get('User-Agent')
          }
        });

        const result = await handler(req, res);

        if (result.html) {
          res.send(result.html);
        } else if (result.redirect) {
          res.redirect(result.redirect);
        } else {
          res.json({
            success: result.success,
            data: result.data,
            message: result.message,
            timestamp: new Date().toISOString()
          });
        }

        logger.info(`${this.operation} - Request completed successfully`, {
          ...logContext,
          metadata: {
            success: result.success,
            responseType: result.html ? 'html' : result.redirect ? 'redirect' : 'json'
          }
        });

      } catch (error) {
        logger.error(`${this.operation} - Request failed`, error as Error, logContext);
        this.handleError(error, res, logContext);
      }
    };
  }

  /**
   * Standardized error handling
   */
  private handleError(error: unknown, res: Response, _logContext: any): void {
    if (error instanceof AppError) {
      if (error.category === ERROR_CATEGORIES.VALIDATION) {
        res.status(400).json({
          success: false,
          error: error.message,
          details: (error as any).details,
          timestamp: new Date().toISOString()
        });
      } else if (error.category === ERROR_CATEGORIES.AUTH) {
        res.status(401).send(
          HTMLTemplates.authError({
            title: 'Authentication Required',
            message: error.message,
            details: (error as any).details?.join(', ')
          })
        );
      } else {
        res.status(error.statusCode || 500).json({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    } else if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
        timestamp: new Date().toISOString()
      });
    } else {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).send(
        HTMLTemplates.error({
          title: 'Server Error',
          message: 'An unexpected error occurred',
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
        })
      );
    }
  }

  /**
   * Validate request data using Zod schema
   */
  protected validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ErrorFactory.validationFailed(
          'Request validation failed',
          error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        );
      }
      throw error;
    }
  }

  /**
   * Get service with error handling
   */
  protected getService<T>(serviceName: string): T {
    const { getService } = globalThis.require('../services/service-manager');
    const service = getService(serviceName) as T;

    if (!service) {
      throw ErrorFactory.serviceError(
        `Service '${serviceName}' not available`,
        serviceName
      );
    }

    return service;
  }

  /**
   * Create OAuth state parameter
   */
  protected createOAuthState(data: Record<string, any>): string {
    return JSON.stringify({
      timestamp: Date.now(),
      ...data
    });
  }

  /**
   * Parse OAuth state parameter
   */
  protected parseOAuthState(state: string): Record<string, any> {
    try {
      const parsed = JSON.parse(state);

      // Validate state is not too old (30 minutes)
      if (parsed.timestamp && Date.now() - parsed.timestamp > 30 * 60 * 1000) {
        throw new Error('OAuth state expired');
      }

      return parsed;
    } catch {
      throw ErrorFactory.validationFailed('Invalid OAuth state parameter', 'OAuth state parameter is invalid');
    }
  }

  /**
   * Abstract method for route-specific logic
   */
  abstract handle(req: Request, res: Response): Promise<RouteResponse>;
}

/**
 * Route handler decorator for common middleware
 */
export function routeHandler(options: RouteHandlerOptions) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const handler = new (class extends BaseRouteHandler {
        constructor() {
          super(options.operation, options);
        }

        async handle(req: Request, res: Response): Promise<RouteResponse> {
          return originalMethod.apply(this, [req, res]);
        }
      })();

      return (handler as any).createHandler(handler.handle.bind(handler))(...args);
    };

    return descriptor;
  };
}