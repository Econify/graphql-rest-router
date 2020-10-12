const { assert } = require('chai');
const Route = require('../Route').default;
const fs = require('fs');

describe('Route', () => {
  const graphQLEndpoint = 'http://example.com';
  const schema = fs.readFileSync(`${__dirname}/schema.example.graphql`, 'utf8');

  describe('#constructor', () => {
    describe('with valid arguments', () => {
      describe('when using minimal configuration', () => {
        const operationName = 'GetUserById';
        let route;

        beforeEach(() => {
          route = new Route({ graphQLEndpoint, schema, operationName });
        });

        it('should set path to the operation name', () => {
          assert.equal(route.path, `/${operationName}`);
        });
      });

      describe('when using full configuration', () => {
        const configuration = {
          schema,
          graphQLEndpoint,
          operationName: 'GetUserByEmail',
          path: '/user/:id',
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
      });

      describe('when using chained configuration', () => {
        let route;
        beforeEach(() => {
          route = new Route({ graphQLEndpoint, schema, operationName: 'GetUserById' });
        });

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
        new Route({ graphQLEndpoint, schema, operationName: 'FakeQuery' });
      }, Error);
    });

    describe('when given an operation name that exists in the schema', () => {
      let route;
      let operationName = 'GetUserById';

      beforeEach(() => {
        route = new Route({ schema, operationName, graphQLEndpoint });
      });

      it('should set operation name', () => {
        assert.equal(route.operationName, operationName);
      });

      it('should set operation variables', () => {
        const operationVariables = {
          id: {
            name: 'id',
            required: true,
            type: 'Int',
            array: false,
            defaultValue: undefined,
          }
        };

        assert.deepEqual(route.operationVariables, operationVariables);
      });
    });
  });

  describe('#path', () => {
    it('should use the operation name as the default path', () => {
      const operationName = 'GetUserById';

      const route = new Route({ graphQLEndpoint, schema, operationName });
      assert.equal(route.path, `/${operationName}`);
    });
  });

  describe('#areVariablesValid', () => {
  });

  describe('#asExpressRoute', () => {
  });

  describe('#asKoaRoute', () => {
  });
});
