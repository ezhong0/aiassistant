import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import express, { Request, Response } from 'express';
import logger from './utils/logger';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import protectedRoutes from './routes/protected.routes';

const app = express();
const port = 3000;

app.use(express.json());
app.use(requestLogger);

// Routes
app.use('/auth', authRoutes);
app.use('/protected', protectedRoutes);

app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Hello World!' });
});

app.get('/health', (req: Request, res: Response) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    memory: {
      used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
      total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
    },
  };

  res.status(200).json(healthCheck);
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(port, () => {
  logger.info(`Server running at http://localhost:${port}`);
});

server.on('error', (err) => {
  logger.error('Server error:', err);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

logger.info('Server setup complete');
