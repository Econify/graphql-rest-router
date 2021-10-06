/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO: UNDO THESE ^^
import * as express from 'express';
import * as bodyParser from 'body-parser';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { parse, DocumentNode, getOperationAST } from 'graphql';

import Route from './Route';
import { IGlobalConfiguration, IMountableItem, IConstructorRouteOptions } from './types';
import { LogLevels } from './Logger';

// TODO: Fix this in ts config and change to import
// eslint-disable-next-line @typescript-eslint/no-var-requires
const version = require('../package.json').version;

const DEFAULT_CONFIGURATION: IGlobalConfiguration = {
  cacheEngine: undefined,
  logger: undefined,
  auth: undefined,
  proxy: undefined,
  defaultLogLevel: LogLevels.ERROR,
  defaultTimeoutInMs: 10000,
  defaultCacheTimeInMs: 0,
  autoDiscoverEndpoints: false,
  optimizeQueryRequest: false,
  headers: { 'x-graphql-rest-router-version': version },
};

export default class Router {
  private schema: DocumentNode;
  private options: IGlobalConfiguration;

  public routes: Route[] = [];
  public modules: IMountableItem[] = [];
  public axios: AxiosInstance;

  private passThroughHeaders: string[] = [];

  constructor(public endpoint: string, schema: string, assignedConfiguration?: IGlobalConfiguration) {
    const {
      auth,
      proxy,
      defaultTimeoutInMs: timeout,
      passThroughHeaders,
      ...options
    } = {
      ...DEFAULT_CONFIGURATION,
      ...assignedConfiguration,

      // Default headers should always override
      headers: {
        ...(assignedConfiguration || {}).headers,
        ...DEFAULT_CONFIGURATION.headers,
      },
    };

    const axiosConfig: AxiosRequestConfig = {
      baseURL: endpoint,
      method: 'post',
      headers: options.headers,
      timeout,
      auth,
      proxy,
      responseType: 'json',
    };

    this.schema = parse(schema);
    this.axios = axios.create(axiosConfig);

    if (passThroughHeaders) {
      this.passThroughHeaders = passThroughHeaders;
    }

    this.options = options;
  }

  private queryForOperation(operationName: string) {
    const { schema, options } = this;
    const { optimizeQueryRequest } = options;

    if (optimizeQueryRequest) {
      console.warn(
        'optimizeQueryRequest is a beta feature. It does not work with fragments'
      );

      return getOperationAST(schema, operationName);
    }

    return schema;
  }

  mount(operationName: string, options?: any): Route;
  mount(mountableItem: IMountableItem, options?: any): IMountableItem;
  mount(operationNameOrMountableItem: string | IMountableItem, options?: any): IMountableItem {
    if (typeof operationNameOrMountableItem === 'string') {
      const {
        schema,
        axios,
        options: { logger, defaultLogLevel, cacheEngine, defaultCacheTimeInMs, cacheKeyIncludedHeaders },
      } = this;
      const operationName = operationNameOrMountableItem;

      // eslint-disable-next-line no-extra-boolean-cast
      const passThroughHeaders = Boolean(options)
        ? [...this.passThroughHeaders, ...options.passThroughHeaders]
        : [...this.passThroughHeaders];

      const routeOptions: IConstructorRouteOptions = {
        ...options,
        operationName,

        axios,
        schema,

        cacheEngine,
        cacheTimeInMs: defaultCacheTimeInMs,
        cacheKeyIncludedHeaders: cacheKeyIncludedHeaders?.map(s => s.toLowerCase()),

        logger,
        defaultLogLevel,

        passThroughHeaders: passThroughHeaders.map(s => s.toLowerCase()),
      };

      const graphQLRoute = new Route(routeOptions);

      this.routes.push(graphQLRoute);

      return graphQLRoute;
    }

    const mountedItem = operationNameOrMountableItem.withOptions(options);

    if (mountedItem.onMount) {
      mountedItem.onMount(this);
    }

    this.modules.push(mountedItem);

    return mountedItem;
  }

  // TODO: Temporarily using express as metal
  listen(port: number, callback?: () => void): void {
    const router = express();

    router.use(this.asExpressRouter());

    router.listen(port, callback);
  }

  asExpressRouter(): express.Router {
    const router: any = express.Router();

    router.use(bodyParser.json());

    [...this.modules, ...this.routes].forEach((route) => {
      const { path, httpMethod } = route;
      const routeFn = route.asExpressRoute();

      router[httpMethod](path, routeFn);
    });

    return router;
  }

  asKoaRouter(): never {
    throw new Error('Not Implemented');
  }
}

