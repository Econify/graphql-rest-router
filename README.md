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
While GraphQL has gained traction recently, the majority of GraphQL endpoints are used internally and not distributed or endorsed for public use. Items such as authentication, permissions, priveleges and sometimes even performance on certain keys are not seen as primary concerns as the API is deemed "internal". Because of this, any exposure of your GraphQL server to the public internet exposes you to risk (e.g. DDOS by allowing unknown users to create their own non-performant queries, accidental exposure of sensitive data, etc).

GraphQL Rest Router attempts to solve these problems by allowing you to leverage GraphQL upstream for all of your data resolution, but exposes predefined queries downstream to the public in the form of cacheable RESTful urls.

Instead of exposing your server by having your client or web application (e.g. React, Angular, etc...) perform api calls directly to `http://yourgraphqlserver.com/?query={ getUserById(1) { firstName, lastName }` that could then be altered to `http://yourgraphqlserver.com/?query={ getUserById(1) { firstName, lastName, socialSecurityNumber }`, GraphQL Rest Router allows you to predefine a query and expose it as a restful route, such as `http://yourserver/api/users/1`. This ensures end users are only able to execute safe, performant, and tested queries.

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
When dealing with a publicly exposed GraphQL server that implements users and priveleges, the main benefit GraphQL Rest Client provides is caching. While implementing individual caches at a content-level with push-expiration in the GraphQL server is optimal, building these systems is laborous and isn't always prioritized in an MVP product. GraphQL Rest Client allows you to expose a GraphQL query as a REST endpoing with built in cache management that is compatible with all CDNs and cache management layers (e.g. CloudFlare, Akamai, Varnish, etc).

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
GRR is still in alpha so the DSL may be subject to changes.

Get started by installing GraphQL Rest Router as a production dependency in your application with: `npm install --save graphql-rest-router`.

To instantiate a bare bones GraphQL Rest Router instance you'll need both the location of your GraphQL Server and the client schema you'll be using. It is advised that you create one `.gql` file per application that holds all of the application's respective queries.

GQL Rest Router leverages [Operation Names](https://graphql.org/learn/queries/#operation-name) and [Variables](https://graphql.org/learn/queries/#variables) as a way to transform your provided schema into a REST endpoint. **Make sure that your queries and mutations are all utilizing operation names or they will not be mountable.**

For Example:
```gql
# THIS
query GetFirstUser {
  getUser(id: 1) {
    id
    firstName
    lastName
  }
}

# NOT THIS
{
  getUser(id: 1) {
    id
    firstName
    lastName
  }
}
```

Once you have your schema and your endpoint, instantiation is straight-forward:

```js
import GraphQLRestRouter from 'graphql-rest-router';

const schema = fs.readFile(`${__dirname}/schema.gql`);
const endpoint = 'http://mygraphqlserver.com:9000';

const api = new GraphQLRestRouter(endpoint, schema);
```

### Proxies and Authentication
If the server that you are running GraphQL Rest Router on requires a proxy to connect to the GraphQL server or credentials to connect, you may pass them directly into GQL Rest Router during instantiation or on a per route basis to limit them to specific routes.

### Advanced Configuration of GraphQL Rest Router
GraphQL Rest Router takes an optional third parameter during initialization that allows you to control default cache, headers, authentication and proxies

```
const options = {
  defaultCacheTimeInMs: 3000,
};

new GraphQLRestRouter(endpoint, schema, options);
```

A list of options and their default values is below:
**TODO TABLE HERE**

### Creating Endpoints

### GET / POST

## Caching
GraphQL Rest Router ships with two cache interfaces stock and supports any number of custom or third party caching interfaces as long as they adhere to `ICacheInterface`

### In Memory Cache
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
As of the time of this writing, a REDIS interface for GQL Rest Router is not yet available. Feel free to submit a PR.

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

### API Blueprint
Planned for V1 but not available in Alpha

## Custom Routes

## Usage with Web Frameworks
Currently GQL Rest Router only supports Express out of the box. Please submit a PR or an Issue if you would like to see GQL Rest Router support additional frameworks.

### Usage with Express
It is common to leverage GraphQL Rest Client on a server that is already delivering a website as opposed to standing up a net new server. To integrate with an existing express server, simply export GraphQL Rest Router as express using `.asExpressRouter()` instead of starting up a new server using `.listen(port)`.

For Example:
```js
// api.js
const api = new GraphQLRestRouter(endpoint, schema);

api.mount('GetUserById').at('/users/:id');

export default api.asExpressRouter();

// server.js
import express from 'express';
import api from './api';

const app = express();

app.get('/status', (req, res) => ...);
app.get('/', (req, res) => ...);
app.use('/api', api); // MOUNTS GQL REST ROUTER ON :3000/api/* (e.g. :3000/api/users/4)

app.listen(3000);
```

### Usage with KOA
As of the time of this writing, a KOA extension for GQL Rest Router is not yet available. Feel free to submit a PR.

### Code Examples
See the [examples folder](/examples) in this repo for code examples.
