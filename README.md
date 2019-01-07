# GraphQL Rest Router
GraphQL Rest Router allows you to expose an internal GraphQL API as a REST API without exposing the entire schema with a simple DSL.

```js
import GraphQLRestRouter from 'graphql-rest-router';
const clientSchema = fs.require('./clientSchema.gql', 'utf-8');

const options = {
  defaultCacheTimeInMS: 10
};

const api = new GraphQLRestRouter('http://graphqlurl.com', clientSchema, options);

api.mount('SearchUsers').at('/users');
api.mount('GetUserById').at('/users/:id');
api.mount('CreateUser').at('/users').as('post').disableCache();

api.listen(3000, () => {
  console.log('GraphQL Rest Router is listening!');
});
```

__Table of Contents__
- [Overview / Introduction](/#)
  - [Internal GraphQL Usage](/#)
  - [External GraphQL Usage](/#)
- [Documentation](/#)
  - [Getting Started](/#)
  - [Caching](/#)
  - [Swagger / OpenAPI / Documentation](/#)
  - [Custom Routes](/#)
  - [Express.js Usage](/#)
  - [KOA Usage](/#)
  - [Examples](/#)
- Misc
  - [Typescript](/#)
  - [Contributing](/#)
  - [Support](/#)

# Overview
GraphQL has gained addoption as a replacement to the conventional REST API and for good reason. Development Time/Time to Market are signficantly shortened when no longer requiring every application to build and maintain its own API.

## Internal GraphQL API
While GraphQL has gained traction recently, the majority of GraphQL endpoints are used internally and not distributed or endorsed for public use. Because of this, exposing your GraphQL server to the public internet exposes you to risk (e.g. DDOS by allowing unknown users to create their own non-performant queries, accidental exposure of sensitive data, etc).

GraphQL Rest Router attempts to solve these problems by allowing you to leverage GraphQL upstream for all of your data resolution, but exposing predefined queries to the downstream to the public in the form of a cacheable REST url.

Instead of exposing your server by having your web interface interact with api calls directly to `http://yourgraphqlserver.com/?query={ getUserById(1) { firstName, lastName }` that can be altered to `http://yourgraphqlserver.com/?query={ getUserById(1) { firstName, lastName, socialSecurityNumber }`, GraphQL Rest Router allows you to predefine a query and expose it as `http://yourserver/api/users/1` and always execute a safe query with minimal code:

```js
import GraphQLRestRouter from 'graphql-rest-router';
const schema = `
  query GetUserById($id: ID!) {
    getUserById(1) {
      firstName
      lastName
    }
  }
  
  query SearchUsers($page: Int) {
    search(page: $page) {
      id
      firstName
      lastName
    }
  }
`;

const api = new GraphQLRestRouter('http://yourgraphqlserver.com', schema);

api.mount('GetUserById').at('/users/:id');
api.mount('SearchUsers').at('/users')
  .disableCache();

api.listen(3000);
```

See [Usage with Express](/#) and read [Getting Started](/#) to see all available options.

## External GraphQL API
When dealing with a publicly exposed GraphQL layer, the main benefit GraphQL Rest Client provides is caching. While implementing individual caches at a content level with dynamic expiration in the GraphQL layer is optimal, actually building these systems out are laborous and aren't always included in MVP products. GraphQL Rest Client allows you to expose a GraphQL query as a REST endpoing with built in cache management that is compatible with all CDNs and cache management layers (e.g. CloudFlare, Akamai, Varnish, etc).

One line of GraphQL Rest Router code allows you to take
```gql

query UserById($id: ID!) {
  getUserById(id: $id) {
    id
    email
    firstName
    lastName
  }
}
```
and expose it as `http://www.youapiurl.com/user/:id`
```js
api.mount('UserById').at('/user/:id');
```

# Documentation
GraphQL Rest Router is available via NPM as `graphql-rest-router` (`npm install graphql-rest-router`)

## Getting Started

### Configuring GraphQL Rest Router

### Mounting Queries

### GET / POST

## Caching
GraphQL Rest Router ships with two cache interfaces stock and supports any number of custom or third party caching interfaces as long as they adhere to `ICacheInterface`

### InMemory Cache
InMemoryCache stores your cached route data on your server in memory. This can be used in development or with low TTLs in order to prevent a [thundering herd](https://en.wikipedia.org/wiki/Thundering_herd_problem) however it is strongly discouraged to use this in production. In Memory caches have the ability to deplete your system's resources and take down your instance of GraphQLRestRouter.

```js
import GraphQLRestRouter from 'graphql-rest-router';
import InMemoryCache from 'graphql-rest-router/InMemoryCache';

const api = new GraphQLRestRouter('http://localhost:1227', schema, {
  cacheEngine: new InMemoryCache(),
  
  defaultCacheTimeInMs: 300,
});

api.mount('CreateUser')
  .disableCache();
  
api.mount('GetUser', { cacheTimeInMs: 500 });
```

### Redis Cache

## Swagger / Open API
As GraphQL Rest Router exposes your API with new routes that aren't covered by GraphQL's internal documentation or introspection queries, GraphQL Rest Router ships with support for Swagger (Open Api V2), Open API (V3) and API Blueprint (planned). When mounting a documentation on GraphQL Rest Router, it will automatically inspect all queries in the schema you provided and run an introspection query on your GraphQL server to dynamically assemble and document the types / endpoints.

### Open API (Preferred)
```js
const OpenApi = require('graphql-rest-router/OpenApi');

const documentation = new OpenApi.V3({
  title: 'My REST API', // REQUIRED!
  version: '1.0.0',     // REQUIRED!
  
  host: 'http://localhost:1227',
  basePath: '/api',
});

const api = new GraphQLRestRouter('http://yourgraphqlendpoint', schema);

api.mount(documentation).at('/docs/openapi');
```

### Swagger
```js
const OpenApi = require('graphql-rest-router/OpenApi');

const swaggerDocumentation = new OpenApi.V2({
  title: 'My REST API', // REQUIRED!
  version: '1.0.0',     // REQUIRED!
  
  host: 'http://localhost:1227',
  basePath: '/api',
});

const api = new GraphQLRestRouter('http://yourgraphqlendpoint', schema);

api.mount(swaggerDocumentation).at('/docs/swagger');
```


## Custom Routes

## Usage with Express

## Usage with KOA

## Examples
