import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      correlationId: `request-${Date.now()}`,
      operation: 'request_complete',
      metadata: {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      },
    });
    return originalSend.call(this, body);
  };
  
  next();
};