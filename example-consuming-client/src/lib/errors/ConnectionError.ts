const DEFAULT_MESSAGE = 'Unable to connect application to endpoint';

class ConnectionError extends Error {
  constructor(message: string = DEFAULT_MESSAGE) {
    super(message);
    this.name = 'ConnectionError';
  }
}

export default ConnectionError;
