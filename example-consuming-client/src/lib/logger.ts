import * as pino from 'pino';

const { LOG_LEVEL, NODE_ENV } = process.env;

export default pino({
  name: 'graphql-rest-router-test-app',
  level: LOG_LEVEL,
  prettyPrint: NODE_ENV !== 'production',
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
});
