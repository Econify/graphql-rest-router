import 'module-alias/register';

import { createServer } from './server';
import logger from './lib/logger';
import { ConnectionError } from './lib/errors';

export const app = async (): Promise<void> => {
  try {
    await createServer();
  } catch (e) {
    logger.error(e);
    throw new ConnectionError();
  }
};

/* istanbul ignore next */
if (require.main === module) {
  app();
}
