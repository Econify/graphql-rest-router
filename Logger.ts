import { ILogger, LogLevel } from ".";

export default class Logger implements ILogger {
  private loggerObject: ILogger;
  private logLevel: number;

  constructor(loggerObject: ILogger, logLevel: LogLevel) {
    this.loggerObject = loggerObject;
    this.logLevel = logLevel;
  }

  private shouldLog(level: LogLevel) {
    return level <= this.logLevel;
  }

  public setLogLevel(level: LogLevel) {
    this.logLevel = level;
  }

  public debug(message: String) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.loggerObject.debug(message);
    }
  }

  public info(message: String) {
    if (this.shouldLog(LogLevel.INFO)) {
      this.loggerObject.info(message);
    }
  }

  public warn(message: String) {
    if (this.shouldLog(LogLevel.WARN)) {
      this.loggerObject.warn(message);
    }
  }

  public error(message: String) {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.loggerObject.error(message);
    }
  }
}
