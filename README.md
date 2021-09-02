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

## Table of Contents
- [Overview / Introduction](#overview)
  - [Internal GraphQL Usage](#internal-graphql-api)
  - [External GraphQL Usage](#external-graphql-api)
- [Documentation](#documentation)
  - [Getting Started (Recommended)](#getting-started)
  - [Creating Endpoints (Recommended)](#creating-endpoints)
  - [Proxies / Authentication](#proxies-and-authentication)
  - [Advanced Options](#advanced-configuration-of-graphql-rest-router)
  - [Caching / Redis](#caching)
  - [Swagger / OpenAPI / Documentation](#swagger--open-api)
  - [Express.js Usage](#usage-with-express)
  - [KOA Usage](#usage-with-koa)
  - [Examples](#code-examples)

# Overview
GraphQL has gained adoption as a replacement to the conventional REST API and for good reason. Development Time/Time to Market are signficantly shortened when no longer requiring every application to build and maintain its own API.

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

See [Usage with Express](#usage-with-express) and read [Getting Started](#getting-started) to see all available options.

## External GraphQL API
When dealing with a publicly exposed GraphQL server that implements users and priveleges, the main benefit GraphQL Rest Client provides is caching. While implementing individual caches at a content-level with push-expiration in the GraphQL server is optimal, building these systems is laborous and isn't always prioritized in an MVP product. GraphQL Rest Client allows you to expose a GraphQL query as a REST endpoint with built-in cache management that is compatible with all CDNs and cache management layers (e.g. CloudFlare, Akamai, Varnish, etc).

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

# THIS
query GetUser($id: ID!) {
  getUser(id: $id) {
    id
    firstName
    lastName
  }
}
```

Once you have your schema and your endpoint, usage is straight-forward:

```js
import GraphQLRestRouter from 'graphql-rest-router';

const schema = fs.readFile(`${__dirname}/schema.gql`);
const endpoint = 'http://mygraphqlserver.com:9000';

const api = new GraphQLRestRouter(endpoint, schema);

api.mount('GetFirstUser').at('/users/first');
api.mount('GetUser').at('/users/:id');

api.listen(3000);
```

### Creating Endpoints
Once GraphQL Rest Router has been configured setting up endpoints to proxy queries through is simple. Make sure that the schema you've provided is utilizing [Operation Names](https://graphql.org/learn/queries/#operation-name) and `mount(OperationName)` to have GQL Rest Router automatically scan your schema for the desired operation and create a RESTful endpoint for it. If you attempt to mount a non-named query or a query that does not exist within your provided schema, GraphQL Rest Router will throw an exception.

```js
const api = new GraphQLRestRouter(endpoint, schema);

api.mount('OperationName'); // Mounts "query OperationName" as "GET /OperationName"
```

#### GET / POST
By default, mounted queries are GET requests. If you'd like to change that you may specify any http method using `.as()` on a route.

Example:
```js
const api = new GraphQLRestRouter(endpoint, schema);

api.mount('GetUserById');           // GET /GetUserById
api.mount('UpdateUser').as('put');  // PUT /UpdateUser
api.mount('CreateUser').as('post'); // POST /CreateUser
```

#### Variables
GraphQL Rest Router will read your provided schema to determine which variables are required and optional. If you are unsure how to create a named operation with variables, the [official GraphQL documentation](https://graphql.org/learn/queries/#variables) has examples. When mounted as a GET endpoint, the variables will be expected as query parameters, while all other methods will check the body for the required variables.

In order to reduce unnecessary load on the GraphQL server, GQL Rest Router validates the variables you've provided before sending a request to the GraphQL server.

Example Schema:
```gql
# If GetUserById is mounted:
#
# - A GET request to /GetUserById will require you to pass in a query parameter of id or it will error.
#
#   Example:
#     URL: /GetUserById?id=1
#     Method: GET
#
# - A POST request to /GetUserByID will require you to pass in a body that conatins a JSON object with the key id.
#
#   Example:
#     Url: /GetUserById
#     Method: POST
#     Headers: { Content-Type: application/json }
#     Body: { "id": 1 }
#
query GetUserById($id: Int!) {
  getUserById(id: $id) {
    firstName
    lastName
  }
}

# If SearchUsers is mounted:
#
# - A GET request to /SearchUsers will require you to pass in a query parameter of searchTerm or it will error. Optionally you #   may pass in page and resultsPerPage as well (/SearchUsers?searchTerm=pesto&page=1&resultsPerPage=10)
#
#   Example:
#     URL: /SearchUsers?id=1
#     Method: GET
#
# - A POST request to /SearchUsers will require you to pass in a body that conatins a JSON object with the key searchTerm and #   the optional parameters of page and resultsPerPage.
#
#   Example:
#     Url: /GetUserById
#     Method: POST
#     Headers: { Content-Type: application/json }
#     Body: { "searchTerm": "pesto", page: 1 }
#
query SearchUsers($page: Int = 1, $resultsPerPage: Int, $searchTerm: String!) {
  searchUsers(resultsPerPage: $resultsPerPage, page: $page, query: $searchTerm) {
    email
    firstName
    lastName
  }
}
`;
```

#### Custom Paths
If no path is provided to a mounted route, it will be made available exactly as it is type in the operation name:
```js
api.mount('GetUserById'); // Made available at /GetUserById
```

It is possible to change/customize this mounting path by using `.at(pathname)` on a route.
```js
api.mount('GetUserById').at('/user'); // A call to '/user?id=42' will execute a 'GetUserById' operation on your GQL Server with an id of 42
```

It is also possible to describe a required variable in the path using a syntax similar to that of express routes
```js
api.mount('GetUserById').at('/user/:id'); // A call to /user/42 will execute a 'GetUserById'operation on your GQL server with an id of 42
```

### Proxies and Authentication
If the server that you are running GraphQL Rest Router on requires a proxy to connect to the GraphQL server or credentials to connect, you may pass them directly into GQL Rest Router during instantiation or on a per route basis to limit them to specific routes. See [Advanced Configuration of GraphQL Rest Router](#Advanced-Configuration-of-GraphQL-Rest-Router) for implementation

### Advanced Configuration of GraphQL Rest Router
GraphQL Rest Router takes an optional third parameter during initialization that allows you to control default cache, headers, authentication and proxies.

```js
const options = {
  defaultCacheTimeInMs: 3000,
};

new GraphQLRestRouter(endpoint, schema, options);
```

A list of options and their default values is below:

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| defaultCacheTimeInMs | number | 0 | If a cache engine has been provided use this as a default value for all routes and endpoints. If a route level cache time has been provided this value will be ignored |
| defaultTimeoutInMs | number | 10000 | The amount of time to allow for a request to the GraphQL to wait before timing out an endpoint |
| autoDiscoverEndpoints | boolean | false | When set to true, GQL Rest Router will scan the provided client schema you provide and automatically mount an endpoint for each operation name / named query |
| optimizeQueryRequest | boolean | false | (BETA) When set to true, GQL Rest Router will split up the provided schema into the smallest fragment necessary to complete each request to the GraphQL server as opposed to sending the originally provided schema with each request|
| headers | object | {} | Any headers provided here will be sent with each request to GraphQL. If headers are also set at the route level, they will be combined with these headers (Route Headers take priority over Global Headers) |
| passThroughHeaders | array<string> | [] | An array of strings that indicate which headers to pass through from the request to GraphQL Rest Router to the GraphQL Server. (Example: ['x-context-jwt']) |
| auth | [AxiosBasicCredentials](https://github.com/axios/axios/blob/master/index.d.ts#L9-L12) | null | If the GraphQL server is protected with basic auth provide the basic auth credentials here to allow GQL Rest Router to connect. (Example: { username: 'pesto', password: 'foobar' } |
| proxy | [AxiosProxyConfig](https://github.com/axios/axios/blob/master/index.d.ts#L14-L22) | null | If a proxy is required to communicate with your GraphQL server from the server that GQL Rest Router is running on, provide it here. |
| cacheEngine | [ICacheEngine](https://github.com/Econify/graphql-rest-router/blob/master/index.d.ts#L81-L84) | null | Either a cache engine that [ships default](#Caching) with GQL Rest Router or adheres to the [ICacheEngine interface](#Custom-Cache-Engine) |

## Logging
GraphQL Rest Router is capable of logging incoming requests and errors. When creating your router, you may use a logger of your own choice. GraphQL Rest Router allows you to configure log levels. The logger parameter must implement [ILogger](https://github.com/Econify/graphql-rest-router/blob/master/index.d.ts#L92-L97), and is compatible with most standard logging libraries.

```js
import GraphQLRestRouter from 'graphql-rest-router';

const api = new GraphQLRestRouter('http://localhost:1227', schema, {
  logger: console,
  defaultLogLevel: 0 // Log only errors
});

api.mount('CreateUser').setLogLevel(3); // Log everything
api.mount('GetUser').setLogLevel(-1); // Silence
```



## Caching
GraphQL Rest Router ships with two cache interfaces stock and supports any number of custom or third party caching interfaces as long as they adhere to [ICacheEngine](https://github.com/Econify/graphql-rest-router/blob/master/index.d.ts#L81-L84)

### In Memory Cache
InMemoryCache stores your cached route data on your server in memory. This can be used in development or with low TTLs in order to prevent a [thundering herd](https://en.wikipedia.org/wiki/Thundering_herd_problem) however it is strongly discouraged to use this in production. In Memory caches have the ability to deplete your system's resources and take down your instance of GraphQLRestRouter.

```js
import GraphQLRestRouter, { InMemoryCache } from 'graphql-rest-router';

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

### Custom Cache Engine
If you have a unique cache situation, or use a cache that does not ship by default with GQL Rest Router, you may implement a custom cache as long as it adheres to the ICacheEngine interface.

Simply said, provide an object that contains `get` and `set` functions. See `InMemoryCache.ts` as an example.

## Swagger / Open API
As GraphQL Rest Router exposes your API with new routes that aren't covered by GraphQL's internal documentation or introspection queries, GraphQL Rest Router ships with support for Swagger (Open Api V2), Open API (V3) and API Blueprint (planned). When mounting a documentation on GraphQL Rest Router, it will automatically inspect all queries in the schema you provided and run an introspection query on your GraphQL server to dynamically assemble and document the types / endpoints.

### Open API (Preferred)
```js
const { OpenApi } = require('graphql-rest-router');

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
const { OpenApi } = require('graphql-rest-router');

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
As of the time of this writing, a KOA extension for GQL Rest Router is not available. Feel free to submit a PR.

### Code Examples
See the [examples folder](/examples) in this repo for code examples.
