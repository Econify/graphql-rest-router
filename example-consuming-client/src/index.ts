import 'module-alias/register';
import * as express from 'express';

import api from './api';

export const createServer = (): void => {
  const app = express();
  app.use('/api', api);
  // eslint-disable-next-line
  app.listen(4000, () => console.log('Server listening on port 4000'));
};

/* istanbul ignore next */
if (require.main === module) {
  createServer();
}
