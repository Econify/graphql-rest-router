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

const api = new GraphQLRestRouter(url, Schema, {
  cacheEngine: GraphQLRestRouter.InMemoryCache,

  defaultCacheTimeInMs: 300,

  autoDiscoverEndpoints: false,

  headers: {
    'x-jwt': 1234,
  },
});

api.mount({
  operationName: 'UserByEmail'
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
  .setCacheTimeInMs(200);

api.mount('UserById').at('/:id').as('POST')
  .disableCache()
  .modifyRequest(request => {
    request.addHeader('x-jwt', 'test');
  })
  .modifyResponse(response => {
    response.setStatus(200);
  });

api.mount('UserById').withOptions({
  path: '/user/0',

  method: 'GET',
  variables: {
    id: 3
  }
});

// Export Options
api.asExpressRouter();
api.asKoaRouter();
api.listen(3000, () => console.log('Callback'));
```
