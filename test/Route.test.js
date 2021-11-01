const { assert } = require('chai');
const Route = require('../src/Route').default;
const Logger = require('../src/Logger').default;
const fs = require('fs');

describe('Route', () => {
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

        it('should allow you to change logging level with .setLogLevel()', () => {
          const newLogLevel = -1;

          route.setLogLevel(newLogLevel);

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
