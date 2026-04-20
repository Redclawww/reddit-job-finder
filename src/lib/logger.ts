import pino from 'pino';

const logLevel = process.env.LOG_LEVEL || 'info';
const logPretty = process.env.LOG_PRETTY === 'true';

const pinoOptions: pino.LoggerOptions = {
  level: logLevel,
  ...(logPretty && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  }),
};

const rootLogger = pino(pinoOptions);

export function createLogger(component: string): pino.Logger {
  return rootLogger.child({ component });
}

export default rootLogger;
