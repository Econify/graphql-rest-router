import {
  IMountableItem, IConstructorRouteOptions, IRouteOptions,
  IOperationVariableMap, IOperationVariable, IResponse,
}  from '.';

import { IncomingHttpHeaders } from 'http';
import { DocumentNode, parse, print, getOperationAST } from 'graphql';
import { AxiosTransformer, AxiosInstance, AxiosRequestConfig } from 'axios';
import * as express from 'express';

const PATH_VARIABLES_REGEX = /:([A-Za-z]+)/g

/*
enum EHTTPMethod {
  GET = 'get',
  POST = 'post',
  PUT = 'put',
}
*/

function isVariableArray(node: any): boolean {
  if (node.type.kind === 'NonNullType') {
    return isVariableArray(node.type);
  }

  return node.type.kind === 'ListType';
}

function translateVariableType(node: any): string {
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


// NOTE:
// Consider moving the introspection of the graphql query into the routes so that
// we know for certain which variables are INPUT_VARIABLES and which are enums / strings.
//
// This attempts to typecast all unknown types to JSON but the try catch deoptimizes the parsing of the JSON
// and may affect performance.
function attemptJSONParse(variable: string): any {
  try {
    return JSON.parse(variable);
  } catch (e) {
    return variable;
  }
}

function typecastVariable(variable: string, variableDefinition: IOperationVariable): any {
  switch (variableDefinition.type) {
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
  public httpMethod: string = 'get';

  public passThroughHeaders: string[] = [];
  public operationVariables!: IOperationVariableMap;
  public operationName!: string;

  // TODO:
  // The route should be frozen on any type of export
  // (such as asExpressRoute) to ensure that users understand
  // that changes made after export will not be respected by
  // the export and will only be respected on exports made after
  // the change
  private configurationIsFrozen: boolean = false;

  private axios!: AxiosInstance;
  private schema!: DocumentNode;

  private transformRequestFn: AxiosTransformer[] = [];
  private transformResponseFn: AxiosTransformer[] = [];

  private staticVariables: {} = {};
  private defaultVariables: {} = {};

  private cacheTimeInMs: number = 0;

  constructor(configuration: IConstructorRouteOptions) {
    this.configureRoute(configuration);
  }

  private configureRoute(configuration: IConstructorRouteOptions) {
    const { 
      schema, operationName,
      ...options
    } = configuration;

    if (!schema) {
      throw new Error('A valid schema is required to initialize a Route');
    }

    this.schema = typeof schema === 'string' ? parse(schema) : schema;
    this.axios = configuration.axios;

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
        if (headers.hasOwnProperty(header)) {
          passThroughHeaders[header] = headers[header];
        }
      }
    );

    return passThroughHeaders;
  }

  whitelistHeaderForPassThrough(header: string): this {
    this.passThroughHeaders.push(header);

    return this
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

  private getOperationVariables(operation: any): IOperationVariableMap {
    const variableMap: IOperationVariableMap = {};

    operation.variableDefinitions.forEach(
      (node: any): void => {
        const variable: IOperationVariable = {
          name: node.variable.name.value,
          required: node.type.kind === 'NonNullType',
          type: translateVariableType(node),
          array: isVariableArray(node), 
          defaultValue: (node.defaultValue || {}).value,
        };

        variableMap[variable.name] = variable;
      }
    );

    return variableMap;
  }

  private setOperationName(operationName: string): void {
    const operation = getOperationAST(this.schema, operationName);

    if (!Boolean(operation)) {
      throw new Error(`The named query "${operationName}" does not exist in the Schema provided`);
    }

    this.operationName = operationName;
    this.operationVariables = this.getOperationVariables(operation);
  }

  withOptions(options: IRouteOptions): this {
    const {
      path,
      method: httpMethod,
      defaultVariables,
      staticVariables,
      cacheTimeInMs,
      passThroughHeaders,
    } = options;

    if (path) {
      this.at(path);
    }

    if (httpMethod) {
      this.as(httpMethod);
    }

    if (passThroughHeaders) {
      passThroughHeaders.forEach(this.whitelistHeaderForPassThrough.bind(this));
    }

    if (defaultVariables) {
      this.defaultVariables = defaultVariables;
    }

    if (staticVariables) {
      this.staticVariables = staticVariables;
    }

    if (cacheTimeInMs) {
      this.cacheTimeInMs = cacheTimeInMs;
    }

    return this;
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

  private warnForUsageOfStaticVariables(params: {}): void {
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

  private assembleVariables(params: {}): {} {
    const { staticVariables, defaultVariables } = this;

    return { ...defaultVariables, ...params, ...staticVariables };
  }

  private missingVariables(variables: {}): string[] {
    const variablesAsKeys = Object.keys(variables);

    return this.requiredVariables
      .filter(requiredVariable => !variablesAsKeys.includes(requiredVariable));
  }

  // When an encoded value is passed in, it is decoded automatically but will always
  // be a string.
  //
  // This method will iterate through all variables, check their definition type from the spec
  // and typecast them
  private typecastVariables(variables: { [key: string]: string }, encoder?: Function): { [key: string]: any } {
    const parsedVariables: { [key: string]: any }  = {};

    Object.entries(variables).forEach(
      ([variableName, value]) => {
        const variableDefinition = this.operationVariables[variableName];
        const typecastValue = typecastVariable(value, variableDefinition);

        parsedVariables[variableName] = encoder ? encode(typecastValue) : typecastValue;
      }
    );

    return parsedVariables;
  }

  asExpressRoute() {
    return async (req: express.Request, res: express.Response) => {
      const { query, params, body } = req;
      
      const parsedQueryVariables = this.typecastVariables(query);
      const parsedPathVariables = this.typecastVariables(params, encodeURI);

      const providedVariables = { ...parsedQueryVariables, ...parsedPathVariables, ...body };

      // Assemble variables from query, path and default values
      const assembledVariables = this.assembleVariables(providedVariables);
      const missingVariables = this.missingVariables(assembledVariables);

      const headers = this.filterHeadersForPassThrough(req.headers);

      if (missingVariables.length) {
        res.json({
          error: 'Missing Variables',
        });

        return;
      }

      const { statusCode, body: responseBody } =
        await this.makeRequest(assembledVariables, headers);

      res
        .status(statusCode)
        .json(responseBody);
    };
  }

  asKoaRoute() {
    throw new Error('Not available! Submit PR');
  }

  asMetal() {
    throw new Error('Not available! Submit PR');
  }

  // areVariablesValid(variables: {}) {}

  transformRequest(fn: AxiosTransformer): this {
    this.transformRequestFn.push(fn);

    return this;
  }

  transformResponse(fn: AxiosTransformer): this {
    this.transformResponseFn.push(fn);

    return this;
  }

  disableCache(): this {
    this.cacheTimeInMs = 0;

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

  private async makeRequest(variables: {}, headers: {} = {}): Promise<IResponse> {
    const { axios, schema, operationName } = this;

    const config: AxiosRequestConfig = {
      data: {
        query: print(schema),
        variables,
        operationName,
      },

      headers,

      transformRequest: this.transformRequestFn,
      transformResponse: this.transformResponseFn,
    };

    try {
      const { data, status } = await axios(config);

      return <IResponse> { body: data, statusCode: status };
    } catch (error) {
      if (error.response) {
        return <IResponse> {
          body: error.response.data,
          statusCode: error.response.status,
        };
      }

      if (error.message.indexOf("timeout") >= 0) {
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
