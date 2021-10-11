const fs = require('fs');
const { assert } = require('chai');
const sinon = require('sinon');
const { parse } = require('graphql');

const Router = require('../src/Router').default;
const Route = require('../src/Route').default;
const { version } = require('../package.json');

const schema = fs.readFileSync(`${__dirname}/schema.example.graphql`, 'utf8');
const endpoint = 'http://foobar.com';

describe('Router', () => {
  describe('constructor', () => {
    describe('by default', () => {
      let router;

      beforeEach(() => {
        router = new Router(endpoint);
      });

      it('should set cache time to 0', () => {
        assert.equal(router.options.defaultCacheTimeInMs, 0);
      });

      it('should not optimize the request be default', () => {
        assert.equal(router.options.optimizeQueryRequest, false);
      });

      it('should set a graphql-rest-router header', () => {
        assert.deepEqual(router.options.headers, { 'x-graphql-rest-router-version': version });
      });
    });
  });

  describe('#mount', () => {
    describe('schemaless mount', () => {
      let router;
      let spy;

      beforeEach(() => {
        router = new Router(endpoint);
        spy = sinon.spy(Route.prototype, 'configureRoute');
      });

      afterEach(() => {
        Route.prototype.configureRoute.restore();
      });

      function getMountedOperationDetails() {
        const { operationName, schema } = Route.prototype.configureRoute.getCall(0).args[0];

        return { operationName, schema };
      }

      it('should parse nameless inline operation', () => {
        const inlineQuery = '{ users { id displayName } }';
        router.mount(inlineQuery);

        const { operationName, schema } = getMountedOperationDetails();

        assert.equal(operationName, undefined);
        assert.deepEqual(schema, parse(inlineQuery))
      });
    });

    describe('argument overloading', () => {
      const operationName = 'GetUserById';
      const defaultLogLevel = 3;
      let router;
      let spy;

      beforeEach(() => {
        router = new Router(endpoint, schema, { logger: console, defaultLogLevel });
        spy = sinon.spy(Route.prototype, 'configureRoute');
      });

      afterEach(() => {
        Route.prototype.configureRoute.restore();
      });

      function getOperationName() {
        const { operationName } = Route.prototype.configureRoute.getCall(0).args[0];

        return operationName;
      }

      function getLogger() {
        const { logger, logLevel } = Route.prototype.configureRoute.getCall(0).args[0];

        return { logger, logLevel };
      }

      it('should combine operation name into the configuration', () => {
        router.mount(operationName);

        assert.equal(operationName, getOperationName());
      });

      // This test doesn't work
      // it('should get operation name from configuration if only single argument provided', () => {
      //   router.mount({ operationName });

      //   assert.equal(operationName, getOperationName());
      // });

      it('should pass logger object to Route class', () => {
        router.mount(operationName);

        const { logger, logLevel } = getLogger();

        assert.equal(console, logger);
        assert.equal(defaultLogLevel, logLevel);
      })
    });
  });
});
