# graphql-rest-router

GraphQL Rest Router allows you to expose an internal GraphQL API as a REST API.

- Introduction
- DSL / Documentation
- Example Usage
- Caching
- Custom Routes
- Supported Servers

_Example Usage_
```js
import GraphQLRestRouter from 'graphql-rest-router';
import * as OpenApi from 'graphql-rest-router/OpenApi';

const Schema = `
  query UserById($id: Int!) {
    getUserById(id: $id) {
      ...UserDetails
    }
  }

  query UserByEmail($email: String!, $activeOnly: Boolean, $adminOnly: Boolean) {
    getUserByEmail(email: $email, activeOnly: $activeOnly, adminOnly: $adminOnly) {
      ...UserDetails
    }
  }

  fragment UserDetails on User {
    id
    email
  }
`;

const swaggerDoc = new OpenApi.V2({
  title: 'Example API',
  version: '1.0.0',

  host: 'http://127.0.0.1',
  basePath: '/api',
});

const openApiDoc = new OpenApi.V3({
  title: 'Example API',
  version: '1.0.0',

  host: 'http://127.0.0.1',
  basePath: '/api',
});

const api = new GraphQLRestRouter(url, Schema, {
  cacheEngine: GraphQLRestRouter.InMemoryCache,

  defaultCacheTimeInMs: 300,

  autoDiscoverEndpoints: false,

  headers: {
    'x-jwt': 1234,
  },
});

api.mount('UserByEmail', {
  path: '/user/:email',

  method: 'POST',

  variables: {
    'adminOnly': true,
  },

  defaultVariables: {
    'activeOnly': true,
  },

  cacheTimeInMs: 0,
}); // creates GET /user/:email?activeOnly=:active

api.mount('UserById'); // creates GET /UserById?id=:id

api.mount('UserById').at('/:id') // creates GET /:id

api.mount('UserById').at('/:id').as('POST')
  .disableCache()
  .transformRequest(headers => {
    headers['x-context-jwt'] = '1234';
  })

api.mount('UserById').withOptions({
  path: '/user/0',

  method: 'GET',
  variables: {
    id: 3
  }
});

api.mount(swaggerDoc).at('/docs/swagger');
api.mount(openApiDoc).at('/docs/openapi');

// Export Options
module.exports = api.asExpressRouter();
```
