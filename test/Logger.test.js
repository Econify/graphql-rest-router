const { assert } = require('chai');
const { mock, spy } = require('sinon');
const Logger = require('../Logger').default;

const loggerObject = {
  warn: () => undefined,
  debug: () => undefined,
  info: () => undefined,
  error: () => undefined
}
const logMessage = 'Test Message';
const defaultLogLevel = 3;

describe('Logger', () => {
  describe('#constructor', () => {
    it('creates logger instance', () => {
      const logger = new Logger(loggerObject, defaultLogLevel);

      assert.equal(typeof logger, 'object');
    });
  });

  describe('#setLogLevel', () => {
    it('sets the log level', () => {
      const logger = new Logger(loggerObject, defaultLogLevel);
      const newLogLevel = Math.floor(Math.random() * 500);

      logger.setLogLevel(newLogLevel);

      assert.equal(logger.logLevel, newLogLevel);
    })
  })

  describe('logging functions', () => {
    describe('#info', () => {
      let mockLogger;
      let logger;

      beforeEach(() => {
        mockLogger = mock(loggerObject);
        logger = new Logger(loggerObject, defaultLogLevel);
      })

      it('calls logging objects info method', () => {
        mockLogger.expects('info').once().withArgs(logMessage);
        logger.info(logMessage);
        mockLogger.verify();
      });

      it('no ops with lower log level', () => {
        mockLogger.expects('info').never();

        logger.setLogLevel(0);
        logger.info(logMessage);

        mockLogger.verify();
      });
    });

    describe('#warn', () => {
      let mockLogger;
      let logger;

      beforeEach(() => {
        mockLogger = mock(loggerObject);
        logger = new Logger(loggerObject, defaultLogLevel);
      })

      it('calls logging objects warn method', () => {
        mockLogger.expects('warn').once().withArgs(logMessage);
        logger.warn(logMessage);
        mockLogger.verify();
      });

      it('no ops with lower log level', () => {
        mockLogger.expects('warn').never();

        logger.setLogLevel(0);
        logger.warn(logMessage);

        mockLogger.verify();
      });
    });

    describe('#debug', () => {
      let mockLogger;
      let logger;

      beforeEach(() => {
        mockLogger = mock(loggerObject);
        logger = new Logger(loggerObject, defaultLogLevel);
      })

      it('calls logging objects debug method', () => {
        mockLogger.expects('debug').once().withArgs(logMessage);
        logger.debug(logMessage);
        mockLogger.verify();
      });

      it('no ops with lower log level', () => {
        mockLogger.expects('debug').never();

        logger.setLogLevel(0);
        logger.debug(logMessage);

        mockLogger.verify();
      });
    });
    describe('#error', () => {
      let mockLogger;
      let logger;

      beforeEach(() => {
        mockLogger = mock(loggerObject);
        logger = new Logger(loggerObject, defaultLogLevel);
      })

      it('calls logging objects error method', () => {
        mockLogger.expects('error').once().withArgs(logMessage);
        logger.error(logMessage);
        mockLogger.verify();
      });

      it('no ops with lower log level', () => {
        mockLogger.expects('error').never();

        logger.setLogLevel(-1);
        logger.error(logMessage);

        mockLogger.verify();
      });
    });
  });
});
