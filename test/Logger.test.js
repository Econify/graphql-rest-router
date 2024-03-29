const { assert } = require('chai');
const { mock } = require('sinon');
const Logger = require('../src/Logger').default;
const LogLevels = require('../src/Logger').LogLevels;

const loggerObject = {
  warn: () => undefined,
  debug: () => undefined,
  info: () => undefined,
  error: () => undefined
}
const logMessage = 'Test Message';
const defaultLogLevel = LogLevels.DEBUG;

describe('Logger', () => {
  describe('#constructor', () => {
    it('creates logger instance', () => {
      const logger = new Logger();

      assert.equal(typeof logger, 'object');
    });
  });

  describe('#setLogLevel', () => {
    it('sets the log level', () => {
      const logger = new Logger();
      const level = Math.floor(Math.random() * 500);

      logger.setLogLevel(level);

      assert.equal(logger.logLevel, level);
    });
  });

  describe('#setLoggerObject', () => {
    it('sets the logger object', () => {
      const logger = new Logger();
      const logObject = {};

      logger.setLoggerObject(logObject);

      assert.equal(logger.loggerObject, logObject);
    });
  });

  describe('logging functions', () => {
    describe('#info', () => {
      let mockLogger;
      let logger;

      beforeEach(() => {
        mockLogger = mock(loggerObject);
        logger = new Logger().setLoggerObject(loggerObject).setLogLevel(defaultLogLevel);
      })

      it('calls logging objects info method', () => {
        mockLogger.expects('info').once().withArgs(logMessage);
        logger.info(logMessage);
        mockLogger.verify();
      });

      it('no ops with lower log level', () => {
        mockLogger.expects('info').never();

        logger.setLogLevel(LogLevels.ERROR);
        logger.info(logMessage);

        mockLogger.verify();
      });
    });

    describe('#warn', () => {
      let mockLogger;
      let logger;

      beforeEach(() => {
        mockLogger = mock(loggerObject);
        logger = new Logger().setLoggerObject(loggerObject).setLogLevel(defaultLogLevel);
      })

      it('calls logging objects warn method', () => {
        mockLogger.expects('warn').once().withArgs(logMessage);
        logger.warn(logMessage);
        mockLogger.verify();
      });

      it('no ops with lower log level', () => {
        mockLogger.expects('warn').never();

        logger.setLogLevel(LogLevels.ERROR);
        logger.warn(logMessage);

        mockLogger.verify();
      });
    });

    describe('#debug', () => {
      let mockLogger;
      let logger;

      beforeEach(() => {
        mockLogger = mock(loggerObject);
        logger = new Logger().setLoggerObject(loggerObject).setLogLevel(defaultLogLevel);
      })

      it('calls logging objects debug method', () => {
        mockLogger.expects('debug').once().withArgs(logMessage);
        logger.debug(logMessage);
        mockLogger.verify();
      });

      it('no ops with lower log level', () => {
        mockLogger.expects('debug').never();

        logger.setLogLevel(LogLevels.ERROR);
        logger.debug(logMessage);

        mockLogger.verify();
      });
    });
    describe('#error', () => {
      let mockLogger;
      let logger;

      beforeEach(() => {
        mockLogger = mock(loggerObject);
        logger = new Logger().setLoggerObject(loggerObject).setLogLevel(defaultLogLevel);
      })

      it('calls logging objects error method', () => {
        mockLogger.expects('error').once().withArgs(logMessage);
        logger.error(logMessage);
        mockLogger.verify();
      });

      it('no ops with lower log level', () => {
        mockLogger.expects('error').never();

        logger.setLogLevel(LogLevels.SILENT);
        logger.error(logMessage);

        mockLogger.verify();
      });
    });
  });
});
