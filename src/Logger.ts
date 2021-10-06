import { ILogger, ILogLevels, LogLevel } from './types';

export const LogLevels: ILogLevels = {
  SILENT: -1,
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

export default class Logger implements ILogger {
  private loggerObject?: ILogger;
  private logLevel: LogLevel = LogLevels.INFO;

  private shouldLog(level: LogLevel) {
    return level <= this.logLevel;
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  public setLoggerObject(loggerObject: ILogger): void {
    this.loggerObject = loggerObject;
  }

  public debug(message: string): void {
    if (this.loggerObject && this.shouldLog(LogLevels.DEBUG)) {
      this.loggerObject.debug(message);
    }
  }

  public info(message: string): void {
    if (this.loggerObject && this.shouldLog(LogLevels.INFO)) {
      this.loggerObject.info(message);
    }
  }

  public warn(message: string): void {
    if (this.loggerObject && this.shouldLog(LogLevels.WARN)) {
      this.loggerObject.warn(message);
    }
  }

  public error(message: string): void {
    if (this.loggerObject && this.shouldLog(LogLevels.ERROR)) {
      this.loggerObject.error(message);
    }
  }
}
