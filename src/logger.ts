import pino from 'pino';
import { config } from './config.js';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: config.logLevel,
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
});
