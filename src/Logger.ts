import { ILogger, LogLevel } from './types';

export default class Logger implements ILogger {
  private loggerObject: ILogger;
  private logLevel: LogLevel;

  constructor(loggerObject: ILogger, logLevel: LogLevel) {
    this.loggerObject = loggerObject;
    this.logLevel = logLevel;
  }

  private shouldLog(level: LogLevel) {
    return level <= this.logLevel;
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  public debug(message: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.loggerObject.debug(message);
    }
  }

  public info(message: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.loggerObject.info(message);
    }
  }

  public warn(message: string): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.loggerObject.warn(message);
    }
  }

  public error(message: string): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.loggerObject.error(message);
    }
  }
}
