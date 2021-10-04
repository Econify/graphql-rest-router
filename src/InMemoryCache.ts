import { ICacheEngine } from './types';

const STORE_EXPIRATION_CHECK_IN_MS = 10;
const DEFAULT_CACHE_TIME_IN_MS = 10;

export default class InMemoryCache implements ICacheEngine {
  private store: { [key: string]: string } = {};
  private storeCacheExpiration: { [key: string]: number } = {};

  constructor() {
    this.monitorStoreForExpiredValues();
  }

  public get(key: string): string {
    return this.store[key];
  }

  public set(
    key: string, value: string,
    cacheTimeInMs: number = DEFAULT_CACHE_TIME_IN_MS
  ): void {
    this.store[key] = value;

    console.log(cacheTimeInMs);
    this.storeCacheExpiration[key] = new Date().getTime() + cacheTimeInMs;
  }

  private monitorStoreForExpiredValues(): void {
    const { store, storeCacheExpiration } = this;

    setInterval((): void => {
      const currentTime = new Date().getTime();

      Object.keys(storeCacheExpiration).forEach((key: string): void => {
        if (storeCacheExpiration[key] < currentTime) {
          delete storeCacheExpiration[key];
          delete store[key];
        }
      });
    }, STORE_EXPIRATION_CHECK_IN_MS);
  }
}
