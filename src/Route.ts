import { IncomingHttpHeaders } from 'http';
import {
  OperationDefinitionNode, ListTypeNode, VariableDefinitionNode,
  parse, print, getOperationAST, NonNullTypeNode, DocumentNode,
} from 'graphql';
import axios, { AxiosTransformer, AxiosInstance, AxiosRequestConfig } from 'axios';
import * as express from 'express';

import { createHash } from 'crypto';

import {
  IMountableItem, IConstructorRouteOptions, IRouteOptions, LogLevel, ILogger,
  IOperationVariableMap, IOperationVariable, IResponse, ICacheEngine,
}  from './types';

import Logger from './Logger';

const PATH_VARIABLES_REGEX = /:([A-Za-z]+)/g;

/*
enum EHTTPMethod {
  GET = 'get',
  POST = 'post',
  PUT = 'put',
}
*/

function optionsDeprecationWarning(methodName: string) {
  /* Use console.warn instead of Logger instance
   * so it always logs the warning regardless of logger configuration */
  console.warn(`Deprecated method ${methodName}() called. This function will be removed in a later version, please use withOption() or withOptions() instead.`);
}

function isVariableArray(node: VariableDefinitionNode | NonNullTypeNode): boolean {
  if (node.type.kind === 'NonNullType') {
    return isVariableArray(node.type);
  }

  return node.type.kind === 'ListType';
}

function translateVariableType(node: VariableDefinitionNode | ListTypeNode | NonNullTypeNode): string {
  if (node.type.kind === 'NonNullType' || node.type.kind === 'ListType') {
    return translateVariableType(node.type);
  }

  return node.type.name.value;
}

function cleanPath(path: string): string {
  if (path[0] === '/') {
    return path;
  }

  return `/${path}`;
}

function getDefaultValue(node: VariableDefinitionNode): string | boolean | number | null | undefined {
  if (
    !node.defaultValue ||
    node.defaultValue.kind === 'Variable' ||
    node.defaultValue.kind === 'ListValue' ||
    node.defaultValue.kind === 'ObjectValue'
  ) {
    // TODO: implement different kinds of variables
    return undefined;
  }

  if (node.defaultValue.kind === 'NullValue') {
    return null;
  }

  return node.defaultValue.value;
}


// NOTE:
// Consider moving the introspection of the graphql query into the routes so that
// we know for certain which variables are INPUT_VARIABLES and which are enums / strings.
//
// This attempts to typecast all unknown types to JSON but the try catch deoptimizes the parsing of the JSON
// and may affect performance.
function attemptJSONParse(variable: string): string | unknown {
  try {
    return JSON.parse(variable);
  } catch (e) {
    return variable;
  }
}

function typecastVariable(
  variable: string,
  variableDefinition: IOperationVariable
): string | boolean | number | unknown {
  switch (variableDefinition && variableDefinition.type) {
    case 'Int':
      return parseInt(variable, 10);
    case 'Boolean':
      return Boolean(variable);
    case 'String':
      return variable;
    default:
      return attemptJSONParse(variable);
  }
}

export default class Route implements IMountableItem {
  public path!: string;
  public httpMethod = 'get';

  public passThroughHeaders: string[] = [];
  public operationVariables!: IOperationVariableMap;
  public operationName?: string;

  // TODO:
  // The route should be frozen on any type of export
  // (such as asExpressRoute) to ensure that users understand
  // that changes made after export will not be respected by
  // the export and will only be respected on exports made after
  // the change
  private configurationIsFrozen = false;

  private axios!: AxiosInstance;
  private schema!: DocumentNode;
  private logger!: Logger;

  private transformRequestFn: AxiosTransformer[] = [];
  private transformResponseFn: AxiosTransformer[] = [];

  private staticVariables: Record<string, unknown> = {};
  private defaultVariables: Record<string, unknown> = {};

  private cacheTimeInMs = 0;
  private cacheEngine?: ICacheEngine;
  private cacheKeyIncludedHeaders: Set<string> = new Set();

  constructor(configuration: IConstructorRouteOptions) {
    this.configureRoute(configuration);
  }

  private setDefaultTransforms() {
    const defaultTransformResponse = Array.isArray(axios.defaults.transformResponse)
      && axios.defaults.transformResponse[0];
    const defaultTransformRequest = Array.isArray(axios.defaults.transformRequest)
      && axios.defaults.transformRequest[0];

    if (defaultTransformResponse) {
      this.transformResponseFn.push(defaultTransformResponse);
    }

    if (defaultTransformRequest) {
      this.transformRequestFn.push(defaultTransformRequest);
    }
  }

  private configureRoute(configuration: IConstructorRouteOptions) {
    const {
      schema,
      operationName,
      axios,

      ...options
    } = configuration;

    if (!schema) {
      throw new Error('A valid schema is required to initialize a Route');
    }

    this.setDefaultTransforms();
    this.schema = typeof schema === 'string' ? parse(schema) : schema;
    this.axios = axios;
    this.logger = new Logger();

    this.setOperationName(operationName);

    if (!options.path) {
      options.path = operationName;
    }

    this.withOptions(options);
  }

  private filterHeadersForPassThrough(headers: IncomingHttpHeaders): IncomingHttpHeaders {
    const passThroughHeaders: IncomingHttpHeaders = {};

    this.passThroughHeaders.forEach(
      (header: string) => {
        // eslint-disable-next-line no-prototype-builtins
        if (headers.hasOwnProperty(header)) {
          passThroughHeaders[header] = headers[header];
        }
      }
    );

    return passThroughHeaders;
  }

  private getOperationVariables(operation: OperationDefinitionNode): IOperationVariableMap {
    const variableMap: IOperationVariableMap = {};

    operation.variableDefinitions?.forEach(
      (node: VariableDefinitionNode): void => {
        const variable: IOperationVariable = {
          name: node.variable.name.value,
          required: node.type.kind === 'NonNullType',
          type: translateVariableType(node),
          array: isVariableArray(node),
          defaultValue: getDefaultValue(node)
        };

        variableMap[variable.name] = variable;
      }
    );

    return variableMap;
  }

  private setOperationName(operationName?: string): void {
    const operation = getOperationAST(this.schema, operationName);

    if (!operation) {
      throw new Error(`The named query "${operationName}" does not exist in the Schema provided`);
    }

    this.operationName = operationName;
    this.operationVariables = this.getOperationVariables(operation);
  }

  private get requiredVariables(): string[] {
    return Object.values(this.operationVariables)
      .filter(
        ({ required, defaultValue }) => required && !defaultValue
      )
      .map(
        ({ name }) => name
      );
  }

  private warnForUsageOfStaticVariables(params: Record<string, unknown>): void {
    const staticVariablesAsKeys = Object.keys(this.staticVariables);

    const unassignableVariables = Object.keys(params).filter(
      param => staticVariablesAsKeys.includes(param)
    );

    if (unassignableVariables.length) {
      console.warn(`
        ${this.path} received the following restricted variables with
        the request that will be ignored:
        ${unassignableVariables.join(', ')}.
      `);
    }
  }

  private assembleVariables(params: Record<string, unknown>): Record<string, unknown> {
    const { staticVariables, defaultVariables } = this;

    return { ...defaultVariables, ...params, ...staticVariables };
  }

  private missingVariables(variables: Record<string, unknown>): string[] {
    const variablesAsKeys = Object.keys(variables);

    return this.requiredVariables
      .filter(requiredVariable => !variablesAsKeys.includes(requiredVariable));
  }

  // When an encoded value is passed in, it is decoded automatically but will always
  // be a string.
  //
  // This method will iterate through all variables, check their definition type from the spec
  // and typecast them
  private typecastVariables(variables: { [key: string]: string }): { [key: string]: unknown } {
    const parsedVariables: { [key: string]: unknown }  = {};

    Object.entries(variables).forEach(
      ([variableName, value]) => {
        const variableDefinition = this.operationVariables[variableName];

        parsedVariables[variableName] = typecastVariable(value, variableDefinition);
      }
    );

    return parsedVariables;
  }

  private addPassThroughHeaders(headers: string[] | string) {
    if (Array.isArray(headers)) {
      this.passThroughHeaders = this.passThroughHeaders.concat(headers.map(value => value.toLowerCase()));
    } else {
      this.passThroughHeaders.push(headers.toLowerCase());
    }
    return this;
  }

  private addCacheKeyHeaders(headers: string[] | string) {
    if (Array.isArray(headers)) {
      headers.forEach(v => this.cacheKeyIncludedHeaders.add(v.toLowerCase()));
    } else {
      this.cacheKeyIncludedHeaders.add(headers.toLowerCase());
    }

    return this;
  }

  asExpressRoute() {
    return async (req: express.Request, res: express.Response): Promise<unknown> => {
      const { query, params, body } = req;

      const parsedQueryVariables = this.typecastVariables(query as Record<string, string>);
      const parsedPathVariables = this.typecastVariables(params);

      const providedVariables = { ...parsedQueryVariables, ...parsedPathVariables, ...body };

      // Assemble variables from query, path and default values
      const assembledVariables = this.assembleVariables(providedVariables);
      const missingVariables = this.missingVariables(assembledVariables);

      if (missingVariables.length) {
        res.json({
          error: 'Missing Variables',
        });

        return;
      }

      const { statusCode, body: responseBody } =
        await this.makeRequest(assembledVariables, req.headers);

      res
        .status(statusCode)
        .json(responseBody);
    };
  }

  asKoaRoute(): never {
    throw new Error('Not available! Submit PR');
  }

  asMetal(): never {
    throw new Error('Not available! Submit PR');
  }

  // areVariablesValid(variables: {}) {}

  withOption(option: string, value: unknown): this {
    if (!value || !option) {
      return this;
    }

    switch (option) {
      case 'path':
        return this.at(value as string);
      case 'httpMethod':
      case 'method':
        return this.as(value as string);
      case 'passThroughHeaders':
        return this.addPassThroughHeaders(value as string);
      case 'logger':
        this.logger.setLoggerObject(value as ILogger);
        return this;
      case 'logLevel':
        this.logger.setLogLevel(value as LogLevel);
        return this;
      case 'cacheKeyIncludedHeaders':
        return this.addCacheKeyHeaders(value as string);
      case 'transformRequest':
        this.transformRequestFn.push(value as AxiosTransformer);
        return this;
      case 'transformResponse':
        this.transformResponseFn.push(value as AxiosTransformer);
        return this;
      case 'cacheTimeInMs':
        this.cacheTimeInMs = value as number;
        return this;
      case 'cacheEngine':
        this.cacheEngine = value as ICacheEngine;
        return this;
      case 'staticVariables':
        this.staticVariables = value as Record<string, unknown>;
        return this;
      case 'defaultVariables':
        this.defaultVariables = value as Record<string, unknown>;
        return this;
      default:
        throw new Error(`Invalid option: ${option}`);
    }
  }

  withOptions(options: IRouteOptions): this {
    Object.entries(options).forEach(([k, v]) => {
      this.withOption(k, v);
    });

    return this;
  }

  at(path: string): this {
    this.path = cleanPath(path);

    return this;
  }

  as(httpMethod: string): this {
    // this.httpMethod = EHTTPMethod[EHTTPMethod[httpMethod]];
    this.httpMethod = httpMethod.toLowerCase();

    return this;
  }

  addCacheKeyHeader(header: string): this {
    optionsDeprecationWarning('addCacheKeyHeader');
    this.withOption('cacheKeyIncludedHeaders', header);

    return this;
  }

  whitelistHeaderForPassThrough(header: string): this {
    optionsDeprecationWarning('whitelistHeaderForPassThrough');
    this.withOption('passThroughHeaders', header);

    return this;
  }

  setLogLevel(logLevel: LogLevel): this {
    optionsDeprecationWarning('setLogLevel');
    this.withOption('logLevel', logLevel);

    return this;
  }

  transformRequest(fn: AxiosTransformer): this {
    optionsDeprecationWarning('transformRequest');
    this.withOption('transformRequest', fn);

    return this;
  }

  transformResponse(fn: AxiosTransformer): this {
    optionsDeprecationWarning('transformResponse');
    this.withOption('transformResponse', fn);

    return this;
  }

  setCacheTimeInMs(cacheTimeInMs: number): this {
    optionsDeprecationWarning('setCacheTimeInMs');
    this.withOption('cacheTimeInMs', cacheTimeInMs);

    return this;
  }

  disableCache(): this {
    optionsDeprecationWarning('disableCache');
    this.withOption('cacheTimeInMs', 0);

    return this;
  }

  get queryVariables(): IOperationVariable[] {
    if (this.httpMethod === 'post') {
      return [];
    }

    return this.nonPathVariables;
  }

  get bodyVariables(): IOperationVariable[] {
    if (this.httpMethod === 'get') {
      return [];
    }

    return this.nonPathVariables;
  }

  get pathVariables(): IOperationVariable[] {
    const matches = this.path.match(PATH_VARIABLES_REGEX);

    if (!matches) {
      return [];
    }

    const pathVariableNames = matches.map(match => match.substr(1));

    return Object.values(this.operationVariables).filter(
      ({ name }) => pathVariableNames.includes(name)
    );
  }

  get nonPathVariables(): IOperationVariable[] {
    const pathVariableNames = this.pathVariables.map(({ name }) => name);

    return Object.values(this.operationVariables)
      .filter(
        ({ name }) => !pathVariableNames.includes(name)
      );
  }

  private getRequestFingerprint(
    path: string,
    variables: Record<string, unknown>,
    headers: Record<string, unknown>,
  ) {
    const hash = createHash('sha1');

    hash.update(path);

    Object.entries(variables).forEach(([k, v]) => hash.update(`${k}-${v}`));
    Object.entries(headers).forEach(([k, v]) => {
      if (this.cacheKeyIncludedHeaders.has(k)) {
        hash.update(`${k}-${v}`);
      }
    });

    return hash.digest('hex');
  }

  private async checkCache(fingerprint: string) {
    if (this.cacheEngine && this.cacheTimeInMs !== 0) {
      const cachedResult = await this.cacheEngine.get(fingerprint);

      return cachedResult ? {
        statusCode: 200,
        body: JSON.parse(cachedResult),
      } : null;
    }
  }

  private async makeRequest(
    variables: Record<string, unknown>,
    headers: IncomingHttpHeaders = {}
  ): Promise<IResponse> {
    const { axios, schema, operationName, path } = this;
    const headersForPassThrough = this.filterHeadersForPassThrough(headers);
    const fingerprint = this.getRequestFingerprint(path, variables, headers);

    this.logger.info(`Incoming request on ${operationName} at ${path}, request variables: ${JSON.stringify(variables)}`);

    const cachedResult = await this.checkCache(fingerprint);

    if (cachedResult) {
      this.logger.debug('Cache hit');
      return cachedResult;
    }

    const config: AxiosRequestConfig = {
      data: {
        query: print(schema),
        variables,
        operationName,
      },

      headers: headersForPassThrough,
    };

    if (this.transformRequestFn.length) {
      config.transformRequest = this.transformRequestFn;
    }

    if (this.transformResponseFn.length) {
      config.transformResponse = this.transformResponseFn;
    }

    try {
      const { data, status } = await axios(config);

      data.errors?.forEach((error: unknown) => {
        this.logger.error(`Error in GraphQL response: ${JSON.stringify(error)}`);
      });

      if (this.cacheEngine && this.cacheTimeInMs !== 0) {
        this.logger.debug('Cache miss, setting results');
        this.cacheEngine.set(fingerprint, JSON.stringify(data), this.cacheTimeInMs);
      }

      return <IResponse> { body: data, statusCode: status };
    } catch (error) {
      this.logger.error(error.stack);

      if (error.response) {
        return <IResponse> {
          body: error.response.data,
          statusCode: error.response.status,
        };
      }

      if (error.message.indexOf('timeout') >= 0) {
        return <IResponse> {
          statusCode: 504,
          body: {
            error: error.message,
          },
        };
      }

      return <IResponse> {
        statusCode: 500,
        body: {
          error: error.message,
        },
      };
    }
  }
}
