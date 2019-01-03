import IMountableItem from './IMountableItem';
import Router from './Router';
import { DocumentNode, parse, print, getOperationAST } from 'graphql';
import { AxiosTransformer, AxiosInstance, AxiosRequestConfig } from 'axios';
import * as express from 'express';

const PATH_VARIABLES_REGEX = /:([A-Za-z]+)/g

export interface IConstructorRouteOptions {
  schema: DocumentNode | string; // GraphQL Document Type
  operationName: string;
  axios: AxiosInstance;
  path?: string;
  cacheTimeInMs?: number;
  method?: string;

  staticVariables?: {};
  defaultVariables?: {};
}

export interface IRouteOptions {
  path?: string;
  cacheTimeInMs?: number;
  method?: string;

  staticVariables?: {};
  defaultVariables?: {};
}

export interface IOperationVariable {
  name: string;
  required: boolean;
  type: string;
  defaultValue?: string | boolean | number;
}

export interface IResponse {
  statusCode: number;
  body: {};
}

/*
enum EHTTPMethod {
  GET = 'get',
  POST = 'post',
  PUT = 'put',
}
*/

function translateVariableType(node: any): any {
  if (node.type.kind === 'NonNullType') {
    return translateVariableType(node.type);
  }

  switch (node.type.name.value) {
    case 'Int':
      return 'number';
    case 'Boolean':
      return 'boolean';
    case 'String':
    default:
      return 'string';

  }
}

function cleanPath(path: string): string {
  if (path[0] === '/') {
    return path;
  }

  return `/${path}`;
}

export default class Route implements IMountableItem {
  public path!: string;
  public httpMethod: string = 'get';

  // TODO:
  // The route should be frozen on any type of export
  // (such as asExpressRoute) to ensure that users understand
  // that changes made after export will not be respected by
  // the export and will only be respected on exports made after
  // the change
  private configurationIsFrozen: boolean = false;

  private axios!: AxiosInstance;
  private schema!: DocumentNode;

  private operationName!: string;
  private operationVariables!: IOperationVariable[];

  private transformRequestFn?: AxiosTransformer;
  private transformResponseFn?: AxiosTransformer;

  private staticVariables: {} = {};
  private defaultVariables: {} = {};

  private cacheTimeInMs: number = 0;

  constructor(configuration: IConstructorRouteOptions, private router?: Router) {
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

  setRouter(router: Router): this {
    this.router = router;

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

  private getOperationVariables(operation: any): IOperationVariable[] {
    return operation.variableDefinitions.map(
      (node: any): IOperationVariable => ({
        name: node.variable.name.value,
        required: node.type.kind === 'NonNullType',
        type: translateVariableType(node),
        defaultValue: node.defaultValue,
      })
    );
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
    } = options;

    if (path) {
      this.at(path);
    }

    if (httpMethod) {
      this.as(httpMethod);
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
    return this.operationVariables
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

  asExpressRoute() {
    return async (req: express.Request, res: express.Response) => {
      const { query, params } = req;
      
      const providedVariables = { ...query, ...params };

      // Assemble variables from query, path and default values
      const assembledVariables = this.assembleVariables(providedVariables);
      const missingVariables = this.missingVariables(assembledVariables);

      if (missingVariables.length) {
        res.json({
          error: 'Missing Variables',
        });

        return;
      }

      const { statusCode, body } = await this.makeRequest(assembledVariables);

      res
        .status(statusCode)
        .json(body);
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
    this.transformRequestFn = fn;

    return this;
  }

  transformResponse(fn: AxiosTransformer): this {
    this.transformResponseFn = fn;

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

    return this.operationVariables.filter(
      ({ name }) => pathVariableNames.includes(name)
    );
  }

  get nonPathVariables(): IOperationVariable[] {
    const pathVariableNames = this.pathVariables.map(({ name }) => name);

    return this.operationVariables
      .filter(
        ({ name }) => !pathVariableNames.includes(name)
      );
  }

  private async makeRequest(variables: {}): Promise<IResponse> {
    const { axios, schema, operationName } = this;

    const config: AxiosRequestConfig = {
      data: {
        query: print(schema),
        variables,
        operationName,
      },
    };

    if (this.transformRequestFn) {
      config.transformRequest = this.transformRequestFn;
    }

    if (this.transformResponseFn) {
      config.transformResponse = this.transformResponseFn;
    }

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
