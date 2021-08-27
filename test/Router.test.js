const { assert } = require('chai');
const sinon = require('sinon');
const { parse } = require('graphql');

const Router = require('../Router').default;
const Route = require('../Route').default;
const { version } = require('../package.json');

const fs = require('fs');

const schema = fs.readFileSync(`${__dirname}/schema.example.graphql`, 'utf8');
const endpoint = 'http://foobar.com';

describe('Router', () => {
  describe('constructor', () => {
    describe('by default', () => {
      let router;

      beforeEach(() => {
        router = new Router(endpoint, schema);
      });

      it('should set cache time to 0', () => {
        assert.equal(router.options.defaultCacheTimeInMs, 0);
      });

      it ('should set the cache engine to in memory', () => {});

      it('should not optimize the request be default', () => {
        assert.equal(router.options.optimizeQueryRequest, false);
      });

      it('should set a graphql-rest-router header', () => {
        assert.deepEqual(router.options.headers, { 'x-graphql-rest-router-version': version });
      });
    });
  });

  describe('#mount', () => {
    describe('argument overloading', () => {
      const operationName = 'GetUserById';
      let router;
      let spy;

      beforeEach(() => {
        router = new Router(endpoint, schema);
        spy = sinon.spy(Route.prototype, 'configureRoute');
      });

      afterEach(() => {
        Route.prototype.configureRoute.restore();
      });

      function getOperationName() {
        const { operationName } = Route.prototype.configureRoute.getCall(0).args[0];

        return operationName;
      }

      it('should combine operation name into the configuration', () => {
        router.mount(operationName);

        assert.equal(operationName, getOperationName());
      });
    });
  });

});
