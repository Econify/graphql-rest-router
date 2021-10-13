const { assert } = require('chai');
const Route = require('../src/Route').default;
const Logger = require('../src/Logger').default;
const fs = require('fs');

describe('Route', () => {
  const graphQLEndpoint = 'http://example.com';
  const schema = fs.readFileSync(`${__dirname}/schema.example.graphql`, 'utf8');

  describe('#constructor', () => {
    describe('with valid arguments', () => {
      describe('when using minimal configuration', () => {
        const operationName = 'GetUserById';
        const operationAsPath = `/${operationName}`;
        let route;

        beforeEach(() => {
          route = new Route({ schema, operationName });
        });

        it('should set path to the path and operation name', () => {
          assert.equal(route.operationName, operationName);
          assert.equal(route.path, operationAsPath);
        });
      });

      describe('when using full configuration', () => {
        const configuration = {
          schema,
          operationName: 'GetUserByEmail',
          path: '/user/:id',
          logger: console,
          logLevel: 3,
        };
        let route;

        beforeEach(() => {
          route = new Route(configuration);
        });

        it('should take operation name from configuration', () => {
          assert.equal(route.operationName, configuration.operationName);
        });

        it('should set path correctly', () => {
          assert.equal(route.path, configuration.path);
        });

        it('should create a Logger instance', () => {
          assert.instanceOf(route.logger, Logger, 'route logger is an instance of Logger');
        })
      });

      describe('when using chained configuration', () => {
        let route;
        beforeEach(() => {
          route = new Route({ schema, operationName: 'GetUserById', logger: console, logLevel: 3 });
        });

        it('should allow you to change logging level with .withOption()', () => {
          const newLogLevel = -1;

          route.withOption('logLevel', newLogLevel);

          assert.equal(route.logger.logLevel, newLogLevel);
        })

        it('should allow you to change path with .at()', () => {
          const path = '/test';

          route.at(path);

          assert.equal(route.path, path);
        });

        it('should allow you to change all options with .withOptions()', () => {
          const method = 'POST';

          route.withOptions({ method });

          assert.equal(route.httpMethod, 'post');
        });

        it('should allow you to change http method with .as()', () => {
          const method = 'POST';

          route.as(method);

          assert.equal(route.httpMethod, 'post');
        });

        it('should allow you to chain multiple operations', () => {
          route.as('POST').at('/test');

          assert.equal(route.httpMethod, 'post');
          assert.equal(route.path, '/test');
        });
      });
    });
  });

  describe('#transformResponse', () => {
    const operationName = 'GetUserById';
    let route;

    beforeEach(() => {
      route = new Route({ schema, operationName });
    });

    it('should include the default axios transformResponse', () => {
      assert.equal(route.transformResponseFn.length, 1)
    });

    it('should append additional transforms when called', () => {
      route.withOption('transformResponse', (data) => 'testing transform')
      assert.equal(route.transformResponseFn.length, 2);
    });

    it('should return data as JSON if response is stringified JSON', async () => {
      const stringifiedJSON = "{\"data\":{\"users\":[{\"id\":1,\"name\":\"Charles Barkley\"}]}}";
      const transformResponse = route.transformResponseFn[0];
      const data = await transformResponse(stringifiedJSON);

      assert.strictEqual(typeof data, 'object');
    });
  });

  describe('#transformRequest', () => {
    const operationName = 'GetUserById';
    let route;

    beforeEach(() => {
      route = new Route({ schema, operationName });
    });

    it('should include the default axios transformRequest', () => {
      assert.equal(route.transformRequestFn.length, 1)
    });

    it('should append additional transforms when called', () => {
      route.withOption('transformRequest', (data) => 'testing transform')
      assert.equal(route.transformRequestFn.length, 2);
    });

    it('should return request', async () => {
      const stringifiedRequest = `{"query":"{users}","operationName":"${operationName}"}`;
      const transformRequest = route.transformRequestFn[0];
      const data = await transformRequest(stringifiedRequest);

      assert.strictEqual(data, stringifiedRequest);
    });
  });

  describe('private#setOperationName', () => {
    it('throws an error if operation name does not exist in the schema', () => {
      assert.throws(() => {
        new Route({ schema, operationName: 'FakeQuery' });
      }, Error);
    });

    describe('when given an operation name that exists in the schema', () => {
      let route;
      let operationName = 'GetUserById';

      beforeEach(() => {
        route = new Route({ schema, operationName });
      });

      it('should set operation name', () => {
        assert.equal(route.operationName, operationName);
      });

      it('should set operation variables', () => {
        const name = 'id';

        const operationVariables = {
          [name]: {
            name,
            required: true,
            defaultValue: undefined,
            array: false,
            type: 'Int',
          }
        };

        assert.deepEqual(route.operationVariables, operationVariables);
      });
    });
  });

  describe('#path', () => {
    it('should use the operation name as the default path', () => {
      const operationName = 'GetUserById';
      const operationAsPath = `/${operationName}`;

      const route = new Route({ schema, operationName });

      assert.equal(route.operationName, operationName);
      assert.equal(route.path, operationAsPath);
    });
  });

  describe('#areVariablesValid', () => {
  });

  describe('#asExpressRoute', () => {
  });

  describe('#asKoaRoute', () => {
  });
});
