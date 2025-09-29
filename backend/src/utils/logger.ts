import winston from 'winston';

// Get log level from environment variable directly to avoid circular dependency
const getLogLevel = (): string => {
  return process.env.LOG_LEVEL || 'info';
};

const logger = winston.createLogger({
  level: getLogLevel(), // Use environment variable directly to avoid circular dependency
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
