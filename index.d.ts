import express from 'express';
import Router from './Router';
import { DocumentNode } from 'graphql';
import axios, {
  AxiosBasicCredentials, AxiosProxyConfig, AxiosInstance
} from 'axios';

export interface ILogger {
  error: (message: String) => void;
  warn: (message: String) => void;
  info: (message: String) => void;
  debug: (message: String) => void;
}

export interface IGlobalConfiguration {
  cacheEngine?: ICacheEngine;
  logger?: ILogger;
  defaultTimeoutInMs?: number;
  defaultCacheTimeInMs?: number;
  autoDiscoverEndpoints?: boolean;
  optimizeQueryRequest?: boolean;
  headers?: {};
  passThroughHeaders?: string[];
  auth?: AxiosBasicCredentials;
  proxy?: AxiosProxyConfig;
}

export interface IConstructorRouteOptions {
  schema: DocumentNode | string; // GraphQL Document Type
  operationName: string;
  axios: AxiosInstance;
  logger?: ILogger;
  path?: string;
  cacheTimeInMs?: number;
  method?: string;

  passThroughHeaders?: string[];

  staticVariables?: {};
  defaultVariables?: {};
}

export interface IRouteOptions {
  path?: string;
  cacheTimeInMs?: number;
  method?: string;
  passThroughHeaders?: string[];

  staticVariables?: {};
  defaultVariables?: {};
}

export interface IOperationVariableMap {
  [variableName: string]: IOperationVariable;
}

export interface IOperationVariable {
  name: string;
  required: boolean;
  type: string;
  array: boolean;
  defaultValue?: string | boolean | number;
}

export interface IResponse {
  statusCode: number;
  body: {};
}

export interface IOpenApiOptions {
  title: string;
  version: string;
  termsOfService?: string;
  license?: string;
  basePath?: string;
  host?: string;
}

export interface IMountableItem {
  path: string;
  httpMethod: string;

  at: (path: string) => this;

  asExpressRoute: () => (req: express.Request, res: express.Response) => void;
  asKoaRoute: () => void;
  asMetal: () => void;

  withOptions: (options: any) => this;

  onMount?: (router: Router) => this
}

export interface ICacheEngine {
  get: (key: string, setFn?: () => string|number|boolean) => string|number|boolean;
  set: (key: string, value: string|number|boolean) => void;
}
