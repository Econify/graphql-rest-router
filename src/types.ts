import Router from './Router';
import { AxiosBasicCredentials, AxiosProxyConfig, AxiosInstance } from 'axios';
import { DocumentNode } from 'graphql';
import express from 'express';

export default Router;

export interface IGlobalConfiguration {
  cacheEngine?: ICacheEngine;
  defaultTimeoutInMs?: number;
  defaultCacheTimeInMs?: number;
  logger?: ILogger;
  defaultLogLevel?: LogLevel;
  autoDiscoverEndpoints?: boolean;
  optimizeQueryRequest?: boolean;
  headers?: Record<string, unknown>;
  passThroughHeaders?: string[];
  auth?: AxiosBasicCredentials;
  proxy?: AxiosProxyConfig;
}

export interface IConstructorRouteOptions {
  schema: DocumentNode | string; // GraphQL Document Type
  operationName: string;
  axios: AxiosInstance;
  logger?: ILogger;
  defaultLogLevel: LogLevel;
  path?: string;
  cacheTimeInMs?: number;
  method?: string;

  passThroughHeaders?: string[];

  staticVariables?: Record<string, unknown>;
  defaultVariables?: Record<string, unknown>;
}

export interface IRouteOptions {
  path?: string;
  cacheTimeInMs?: number;
  method?: string;
  passThroughHeaders?: string[];

  staticVariables?: Record<string, unknown>;
  defaultVariables?: Record<string, unknown>;
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
  body: Record<string, unknown>;
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

  withOptions: (options: Record<string, unknown>) => this;

  onMount?: (router: Router) => this
}

export interface ICacheEngine {
  get: (key: string, setFn?: () => string|number|boolean) => string|number|boolean;
  set: (key: string, value: string|number|boolean) => void;
}

export interface ILogger {
  error: (message: String) => void;
  warn: (message: String) => void;
  info: (message: String) => void;
  debug: (message: String) => void;
}

export const enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}
