import * as express from 'express';

import api from './lib/api';

import logger from './lib/logger';

export const createServer = (): void => {
  const app = express();
  app.use('/api', api);
  app.listen(4000, () => logger.info('Server listening on port 4000'));
};
