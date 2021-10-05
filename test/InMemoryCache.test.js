const faker = require('faker');
const { assert } = require('chai');
const { useFakeTimers, restore } = require('sinon');

const InMemoryCache = require('../src/InMemoryCache').default;


describe('InMemoryCache', () => {
  beforeEach(() => {
    this.clock = useFakeTimers();
    this.key = faker.lorem.word();
    this.value = faker.lorem.paragraph();
  });

  afterEach(() => {
    this.clock = restore();
  })

  describe('#constructor', () => {
    it('creates cache instance', () => {
      const cache = new InMemoryCache();

      assert.equal(typeof cache, 'object');
      assert.equal(cache.storeExpirationCheckInMs, 10);
    });

    it('accepts expiration interval override', () => {
      const cache = new InMemoryCache(5000);

      assert.equal(cache.storeExpirationCheckInMs, 5000);
    });

    it('expires values', () => {
      const cacheTime = Math.floor(Math.random() + 19) + 1;
      const cache = new InMemoryCache(cacheTime);

      cache.set(this.key, this.value);
      this.clock.tick(cacheTime + 1);

      const value = cache.get(this.key);

      assert.equal(value, null);
      assert.equal(cache.store[this.key], null)
      assert.equal(cache.storeCacheExpiration[this.key], null)
    })
  });

  describe('#set', () => {
    it('sets a value in the memory cache', () => {
      const cache = new InMemoryCache();

      cache.set(this.key, this.value);

      assert.equal(cache.store[this.key], this.value);
      assert.equal(typeof cache.storeCacheExpiration[this.key], 'number')
    })
  })

  describe('#get', () => {
    it('gets a value from the memory cache', () => {
      const cache = new InMemoryCache();

      cache.store[this.key] = this.value;
      const result = cache.get(this.key);

      assert.equal(result, this.value);
    })
  })
});
