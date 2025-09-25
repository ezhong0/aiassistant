import winston from 'winston';
import { ENVIRONMENT } from '../config/environment';

const logger = winston.createLogger({
  level: ENVIRONMENT.logLevel, // Use environment-configured log level
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Disable file logging temporarily
    // new DailyRotateFile({
    //   filename: 'logs/application-%DATE%.log',
    //   datePattern: 'YYYY-MM-DD',
    //   maxSize: '10m',
    //   maxFiles: '5d'
    // }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

export default logger;
