import ICacheEngine from './ICacheEngine';
import Route, { IConstructorRouteOptions } from './Route';
import express from 'express';
import axios, { AxiosBasicCredentials, AxiosProxyConfig, AxiosInstance, AxiosRequestConfig } from 'axios';
import { parse, DocumentNode, getOperationAST } from 'graphql';
import { version } from './package.json';

interface IGlobalConfiguration {
  cacheEngine?: ICacheEngine;
  defaultTimeoutInMs?: number;
  defaultCacheTimeInMs?: number;
  autoDiscoverEndpoints?: boolean;
  optimizeQueryRequest?: boolean;
  headers?: {};
  auth?: AxiosBasicCredentials;
  proxy?: AxiosProxyConfig;
}

const DEFAULT_CONFIGURATION: IGlobalConfiguration = {
  cacheEngine: undefined,
  auth: undefined,
  proxy: undefined,
  defaultTimeoutInMs: 10000,
  defaultCacheTimeInMs: 0,
  autoDiscoverEndpoints: false,
  optimizeQueryRequest: false,
  headers: { 'x-graphql-rest-router-version': version },
};

function resolveOptionsForMount(operationNameOrOptions: string | {}, optionsOrNull?: {}): any {
  // Combine operation name and options when using argument overloading
  if (typeof operationNameOrOptions === 'string') {
    return {
      ...optionsOrNull,
      operationName: operationNameOrOptions,
    };
  }

  return operationNameOrOptions;
}

export default class Router {
  private schema: DocumentNode;
  private options: IGlobalConfiguration;
  private routes: Route[] = [];
  private axios: AxiosInstance;

  constructor(public endpoint: string, schema: string, assignedConfiguration?: IGlobalConfiguration) {
    const {
      auth,
      proxy,
      defaultTimeoutInMs: timeout,
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

  mount(options: {}): Route;
  mount(operationName: string, options: {}): Route;
  mount(operationNameOrOptions: string | {}, optionsOrNull?: {}): Route {
    const options = resolveOptionsForMount(operationNameOrOptions, optionsOrNull);
    const schema = this.queryForOperation(options.operationName);

    const routeOptions: IConstructorRouteOptions = { schema, ...options };
    const route: Route = new Route(routeOptions, this.axios);
    
    this.routes.push(route);

    return route;
  }

  listen(port: number, callback?: () => void) {
    throw new Error('Not Implemented');
  }

  asExpressRouter() {
    const router: any = express.Router();

    this.routes.forEach((route) => {
      const { path, httpMethod } = route;
      const routeFn = route.asExpressRoute();

      router[httpMethod](path, routeFn);
    });
    
    return router;
  }

  asKoaRouter() {
    throw new Error('Not Implemented');
  }
}

