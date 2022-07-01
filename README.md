# GraphQL Rest Router

GraphQL Rest Router allows you to expose an internal GraphQL API as a REST API without exposing the entire schema with a simple DSL.

```js
import GraphQLRestRouter from 'graphql-rest-router';
const clientSchema = fs.readFileSync('./clientSchema.gql', 'utf-8');

const options = {
  defaultCacheTimeInMS: 10
};

const api = new GraphQLRestRouter('http://graphqlurl.com', clientSchema, options);

api.mount('SearchUsers').at('/users');
api.mount('GetUserById').at('/users/:id');
api.mount('CreateUser').at('/users').as('post').withOption('cacheTimeInMs', 0);

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
- [Upgrading From Alpha](#upgrading-from-alpha)

## Overview

GraphQL has gained adoption as a replacement to the conventional REST API and for good reason. Development Time/Time to Market are signficantly shortened when no longer requiring every application to build and maintain its own API.

### Internal GraphQL API

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
api.mount('SearchUsers').at('/users').withOption('cacheTimeInMs', 0);

api.listen(3000);
```

See [Usage with Express](#usage-with-express) and read [Getting Started](#getting-started) to see all available options.

### External GraphQL API

When dealing with a publicly exposed GraphQL server that implements users and priveleges, the main benefit GraphQL Rest Router client provides is caching. While implementing individual caches at a content-level with push-expiration in the GraphQL server is optimal, building these systems is laborous and isn't always prioritized in an MVP product. GraphQL Rest Router's client allows you to expose a GraphQL query as a REST endpoint with built-in cache management that is compatible with all CDNs and cache management layers (e.g. CloudFlare, Akamai, Varnish, etc).

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

and expose it as `http://www.youapiurl.com/user/:id` with a single line of code:

```js
api.mount('UserById').at('/user/:id');
```

## Documentation

GraphQL Rest Router is available via NPM as `graphql-rest-router` (`npm install graphql-rest-router`)

### Getting Started

Get started by installing GraphQL Rest Router as a production dependency in your application with: `npm install --save graphql-rest-router`.

To instantiate a bare bones GraphQL Rest Router instance you'll need both the location of your GraphQL Server and the client schema you'll be using. It is advised that you create one `.gql` file per application that holds all of the application's respective queries.

GraphQL Rest Router leverages [Operation Names](https://graphql.org/learn/queries/#operation-name) and [Variables](https://graphql.org/learn/queries/#variables) as a way to transform your provided schema into a REST endpoint. **Make sure that your queries and mutations are all utilizing operation names or they will not be mountable.**

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

const schema = fs.readFileSync(`${__dirname}/schema.gql`, 'utf-8');
const endpoint = 'http://mygraphqlserver.com:9000';

const api = new GraphQLRestRouter(endpoint, schema);

api.mount('GetFirstUser').at('/users/first');
api.mount('GetUser').at('/users/:id');

api.listen(3000);
```

### Creating Endpoints

Once GraphQL Rest Router has been configured, setting up endpoints to proxy queries is simple. Make sure that the schema you've provided is utilizing [Operation Names](https://graphql.org/learn/queries/#operation-name) and `mount(OperationName)` to have GraphQL Rest Router automatically scan your schema for the desired operation and create a RESTful endpoint for it. If you attempt to mount a non-named query or a query that does not exist within your provided schema, GraphQL Rest Router will throw an exception.

```js
const api = new GraphQLRestRouter(endpoint, schema);

api.mount('OperationName'); // Mounts "query OperationName" as "GET /OperationName"
```

#### HTTP Methods

By default, mounted queries are GET requests. If you'd like to change that you may specify any HTTP method using `.as()` on a route.

Example:

```js
const api = new GraphQLRestRouter(endpoint, schema);

api.mount('GetUserById');           // GET /GetUserById
api.mount('UpdateUser').as('put');  // PUT /UpdateUser
api.mount('CreateUser').as('post'); // POST /CreateUser
```

#### Variables

GraphQL Rest Router will read your provided schema to determine which variables are required and optional. If you are unsure how to create a named operation with variables, the [official GraphQL documentation](https://graphql.org/learn/queries/#variables) has examples. When mounted as a GET endpoint, the variables will be expected as query parameters, while all other methods will check the body for the required variables.

In order to reduce unnecessary load on the GraphQL server, GraphQL Rest Router validates the variables you've provided before sending a request to the GraphQL server.

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

If no path is provided to a mounted route, it will be made available exactly as it is typed in the operation name:

```js
api.mount('GetUserById'); // Made available at /GetUserById
```

It is possible to change/customize this mounting path by using `.at(pathname)` on a route.

```js
api.mount('GetUserById').at('/user'); // A call to '/user?id=42' will execute a 'GetUserById' operation on your GraphQL Server with an id of 42
```

It is also possible to describe a required variable in the path using a syntax similar to that of express routes

```js
api.mount('GetUserById').at('/user/:id'); // A call to /user/42 will execute a 'GetUserById'operation on your GraphQL server with an id of 42
```

#### Schemaless Mount

A schema is optional with GraphQL Rest Router. You may inline a query on call to `mount()` instead.

Example:

```js
const api = new GraphQLRestRouter(endpoint);

// Simple inline query
api.mount('{ users { displayName } }').at('/usernames'); // GET /usernames

// With a path parameter
api.mount('query GetUserByID($id: ID!) { displayName }').at('/user/:id'); // GET /user/:id
```

### Proxies and Authentication

If the server that you are running GraphQL Rest Router on requires a proxy to connect to the GraphQL server or credentials to connect, you may pass them directly into GraphQL Rest Router during instantiation or on a per route basis to limit them to specific routes. See [Advanced Configuration of GraphQL Rest Router](#Advanced-Configuration-of-GraphQL-Rest-Router) for implementation

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
| cacheKeyIncludedHeaders | string[] | [] | HTTP Headers that are used in the creation of the cache key for requests. This allows users to identify unique requests by specific headers. If these headers specified here differ between requests, they will be considered unique requests. |
| optimizeQueryRequest | boolean | false | When set to true, GraphQL Rest Router will split up the provided schema into the smallest fragment necessary to complete each request to the GraphQL server as opposed to sending the originally provided schema with each request|
| headers | object | {} | Any headers provided here will be sent with each request to GraphQL. If headers are also set at the route level, they will be combined with these headers (Route Headers take priority over Global Headers) |
| passThroughHeaders | string[] | [] | An array of strings that indicate which headers to pass through from the request to GraphQL Rest Router to the GraphQL Server. (Example: ['x-context-jwt']) |
| auth | [AxiosBasicCredentials](https://github.com/axios/axios/blob/76f09afc03fbcf392d31ce88448246bcd4f91f8c/index.d.ts#L9-L12) | null | If the GraphQL server is protected with basic auth provide the basic auth credentials here to allow GraphQL Rest Router to connect. (Example: { username: 'pesto', password: 'foobar' } |
| proxy | [AxiosProxyConfig](https://github.com/axios/axios/blob/76f09afc03fbcf392d31ce88448246bcd4f91f8c/index.d.ts#L14-L22) | null | If a proxy is required to communicate with your GraphQL server from the server that GraphQL Rest Router is running on, provide it here. |
| cacheEngine | [ICacheEngine](https://github.com/Econify/graphql-rest-router/blob/29cc328f23b8dd579a6f4af242266460e95e7d69/src/types.ts#L87-L90) | null | Either a cache engine that [ships default](#Caching) with GraphQL Rest Router or adheres to the [ICacheEngine interface](#Custom-Cache-Engine) |
| logger | [ILogger](https://github.com/Econify/graphql-rest-router/blob/29cc328f23b8dd579a6f4af242266460e95e7d69/src/types.ts#L101-L107) | null | A logger object that implements info, warn, error, and debug methods |
| defaultLogLevel | number | 0 | Default logger level for the logger object |

Routes can be individually configured using the `withOptions` or `withOption` methods. See more usage examples below.

```js
import GraphQLRestRouter, { LogLevels, InMemoryCache } from 'graphql-rest-router';

const api = new GraphQLRestRouter('http://localhost:1227', schema);

// Set individual option
api.mount('CreateUser').withOption('cacheEngine', new InMemoryCache());

// Set two options with one function call
api.mount('GetUser').withOptions({
  logger: console,
  logLevel: LogLevels.DEBUG,
});
```

### Request & Response Transformations

GraphQL Rest Router allows the developer to add transformations on incoming requests or outgoing responses. By default, the regular axios transformers are used.

If the shape of data coming from GraphQL is not what your consuming application needs, transformation logic can be encapsulated inside of the REST layer in the form of these callbacks.

```js
import GraphQLRestRouter from 'graphql-rest-router';

const api = new GraphQLRestRouter('http://localhost:1227', schema);

api.mount('GetImages').withOption('transformResponse', (response) => {
  const { data, errors } = response;

  return {
    data: {
      // Turn images array into image URL map
      images: data.images?.reduce((acc, img) => {
        acc[img.url] = img;
      }, {}),
    }
    errors,
  };
}));
```

You can also modify the outgoing request. These transformers should return the stringified request, but also allow you to modify the request headers.

```js
import GraphQLRestRouter from 'graphql-rest-router';

const api = new GraphQLRestRouter('http://localhost:1227', schema);

api.mount('GetImages').at('/images').withOption('transformRequest', (request, headers) => {
  headers['X-My-Header'] = 'MyValue';
  return request;
});
```

### Logging

GraphQL Rest Router supports robust logging of incoming requests and errors. On instantiation, a logger of your choice can be injected with configurable log levels. The logger object must implement [ILogger](https://github.com/Econify/graphql-rest-router/blob/29cc328f23b8dd579a6f4af242266460e95e7d69/src/types.ts#L101-L107), and log levels must be one of the following [ILogLevels](https://github.com/Econify/graphql-rest-router/blob/f83881d30bdb329a306ebb94fdf577fb065f2e6e/src/types.ts#L107-L113).

```js
import GraphQLRestRouter, { LogLevels } from 'graphql-rest-router';

const api = new GraphQLRestRouter('http://localhost:1227', schema, {
  logger: console,
  defaultLogLevel: LogLevels.ERROR // Log only errors
});

api.mount('CreateUser').withOption('logLevel', LogLevels.DEBUG); // Log everything
api.mount('GetUser').withOption('logLevel', LogLevels.SILENCE); // No logs
```

### Caching

GraphQL Rest Router includes two cache interfaces and supports any number of custom or third party caching interfaces, as long as they implement [ICacheEngine](https://github.com/Econify/graphql-rest-router/blob/29cc328f23b8dd579a6f4af242266460e95e7d69/src/types.ts#L87-L90)

*Important note about cache key creation*: by default, GraphQL Rest Router does not differentiate cache keys based on their HTTP headers. If an upstream GraphQL service returns different responses based on headers, the GraphQL rest router instance would be required to include them in the `cacheKeyIncludedHeaders` global configuration option.

For example, if your application supports `Authorization` headers, you must include that header in the `cacheKeyIncludedHeaders` field. The cache layer will then not serve User A's result to User B. Alternatively, you can disable the cache on authorized routes.

#### In Memory Cache

InMemoryCache stores your cached response data on your server in memory. This can be used in development or with very low throughput, however it is strongly discouraged to use this in production.

```js
import GraphQLRestRouter, { InMemoryCache } from 'graphql-rest-router';

const api = new GraphQLRestRouter('http://localhost:1227', schema, {
  cacheEngine: new InMemoryCache(),
  defaultCacheTimeInMs: 300,
});
 
api.mount('CreateUser').withOption('cacheTimeInMs', 0); // Disable the cache on this route
```

Note: By default the InMemoryCache TTL is 10 milliseconds. This is configurable via the constructor. E.g. `new InMemoryCache(5000)` will expire entries every 5 seconds instead of every 10 milliseconds.

#### Redis Cache

RedisCache stores your cached route data in an external Redis instance. The RedisCache class constructor accepts the [ClientOpts](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/f4b63e02370940350887eaa82ac976dc2ecbf313/types/redis/index.d.ts#L39) object type provided for connection configuration.

```js
import GraphQLRestRouter, { RedisCache } from 'graphql-rest-router';

const api = new GraphQLRestRouter('http://localhost:1227', schema, {
  cacheEngine: new RedisCache({ host: 'localhost', port: 6379 }),
  defaultCacheTimeInMs: 300000, // 5 minutes
});

api.mount('CreateUser').withOption('cacheTimeInMs', 0); // Disable the cache on this route
api.mount('GetUser').withOption('cacheTimeInMs', 500); // Override 5 minute cache
```

#### Custom Cache Engine

You may implement a custom cache engine as long as it adheres to the [ICacheEngine](https://github.com/Econify/graphql-rest-router/blob/af05660d53ee74df10ccc85c9fdc958eec09ff71/src/types.ts#L94-L97) interface.

Simply said, provide an object that contains `get` and `set` functions. See `InMemoryCache.ts` or `RedisCache.ts` as examples.

```js
import GraphQLRestRouter from 'graphql-rest-router';
import CustomCache from ...;

const api = new GraphQLRestRouter('http://localhost:1227', schema, {
  cacheEngine: new CustomCache(),
  defaultCacheTimeInMs: 300,
});
 
api.mount('CreateUser');
```

### Swagger / Open API

As GraphQL Rest Router exposes your API with new routes that aren't covered by GraphQL's internal documentation or introspection queries, GraphQL Rest Router ships with support for Swagger (Open Api V2), Open API (V3) and API Blueprint (planned). When mounting a documentation on GraphQL Rest Router, it will automatically inspect all queries in the schema you provided and run an introspection query on your GraphQL server to dynamically assemble and document the types / endpoints.

#### Open API (Preferred)

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

#### Swagger

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

#### API Blueprint

Not supported yet, please create a PR!

### Usage with Web Frameworks

Currently GraphQL Rest Router only supports Express out of the box. Please submit a PR or an Issue if you would like to see GraphQL Rest Router support additional frameworks.

#### Usage with Express

It is common to leverage GraphQL Rest Router client on a server that is already delivering a website as opposed to standing up a new server. To integrate with an existing express server, simply export GraphQL Rest Router as express using `.asExpressRouter()` instead of starting up a new server using `.listen(port)`.

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
app.use('/api', api); // Mounts GraphQL Rest Router ON :3000/api/* (e.g. :3000/api/users/4)

app.listen(3000);
```

#### Usage with KOA

As of the time of this writing, a KOA extension for GraphQL Rest Router is not available. Feel free to submit a PR.

### Code Examples

See the [example client](/example-consuming-client) in this repo for code examples.

## Upgrading from Alpha

There is one breaking change with the release of `1.0.0-beta.0`: Transform response callbacks now receive parsed data as opposed to the stringified version. Therefore, any callback passed in this way must no longer parse prior to processing.

Chained route methods such as `disableCache()` or `transformResponse()` have been deprecated. Please use `withOption()` or `withOptions()` instead. Support for chained route methods will be removed in a future version.

For example:

```js
// not this
api.mount('GetUserById').at('/users/:id').disableCache().transformResponse(cb);

// this
api.mount('GetUserById').at('/users/:id').withOptions({
  cacheTimeInMs: 0,
  transformResponse: cb,
});
```

## Like this package?

Check out Econify's other GraphQL package, [graphql-request-profiler](https://www.github.com/Econify/graphql-request-profiler), an easy to use performance analysis and visualization tool for tracing API resolver execution time.
