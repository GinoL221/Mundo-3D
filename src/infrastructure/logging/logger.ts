import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

let transport;

if (!isTest && !isProduction) {
  transport = pino.transport({
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'SYS:standard'
    }
  });
}

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || (isTest ? 'silent' : 'info'),
    redact: isProduction ? ['req.headers.authorization', 'req.headers.cookie'] : []
  },
  transport
);
