const faker = require('faker');
const { assert } = require('chai');
const { stub } = require('sinon');

const dependencyModule = require('redis');
const RedisCache = require('../src/RedisCache').default;

describe('RedisCache', () => {
  before(() => {
    stub(dependencyModule, 'createClient').returns({
      setex: (key, _, val, cb) => {
        this.redisStore[key] = val;
        cb(null, true);
      },
      get: (key, cb) => {
        return cb(null, this.redisStore[key])
      }
    });
  });

  beforeEach(() => {
    this.key = faker.lorem.word();
    this.value = faker.lorem.paragraph();
    this.redisStore = {};
  });

  describe('#constructor', () => {
    it('creates cache instance', () => {
      const cache = new RedisCache();

      assert.equal(typeof cache, 'object');
    });
  });

  describe('#set', () => {
    it('sets a value in the memory cache', async () => {
      const cache = new RedisCache();

      await cache.set(this.key, this.value);

      assert.equal(this.redisStore[this.key], this.value);
    });
  });

  describe('#get', () => {
    it('gets a value from the memory cache', async () => {
      const cache = new RedisCache();

      this.redisStore[this.key] = this.value;

      const result = await cache.get(this.key);
      assert.equal(result, this.value)
    });
  });
});
