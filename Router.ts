import IMountableItem from './IMountableItem';
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
  passThroughHeaders?: string[];
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

export default class Router {
  private schema: DocumentNode;
  private options: IGlobalConfiguration;

  public routes: Route[] = [];
  public modules: IMountableItem[] = [];

  private passThroughHeaders: string[] = [];
  private axios: AxiosInstance;

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
      const { schema, axios } = this;
      const operationName = operationNameOrMountableItem;

      const passThroughHeaders = Boolean(options)
        ? [...this.passThroughHeaders, ...options.passThroughHeaders]
        : [...this.passThroughHeaders];

      const routeOptions: IConstructorRouteOptions = {
        ...options,

        operationName,

        axios,
        schema,

        passThroughHeaders,
      };

      const graphQLRoute = new Route(routeOptions, this);

      this.routes.push(graphQLRoute);

      return graphQLRoute;
    }

    const mountableItem = operationNameOrMountableItem;

    const moduleRoute = mountableItem
                          .withOptions(options)
                          .setRouter(this);

    this.modules.push(moduleRoute);

    return moduleRoute;
  }

  listen(port: number, callback?: () => void) {
    throw new Error('Not Implemented');
  }

  asExpressRouter() {
    const router: any = express.Router();

    [...this.modules, ...this.routes].forEach((route) => {
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

