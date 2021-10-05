import { promisify } from 'util';
import { createClient, RedisClient, ClientOpts } from 'redis';
import { ICacheEngine } from './types';

export default class RedisCache implements ICacheEngine {
  private client: RedisClient;
  private setFn: (key: string, cacheTimeInSeconds: number, value: string) => Promise<string>;
  private getFn: (key: string) => Promise<string | null>;

  constructor(options?: ClientOpts) {
    this.client = createClient(options);
    this.setFn = promisify(this.client.setex).bind(this.client);
    this.getFn = promisify(this.client.get).bind(this.client);
  }

  async get(key: string): Promise<string | null> {
    return this.getFn(key);
  }

  async set(key: string, value: string, cacheTimeInMs = 0): Promise<void> {
    const cacheTimeInSec = Math.floor(cacheTimeInMs / 1000);
    await this.setFn(key, cacheTimeInSec, value);
  }
}
