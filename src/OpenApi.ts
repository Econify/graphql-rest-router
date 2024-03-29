import express from 'express';
import describeRouteVariables from './describeRouteVariables';
import Router from './Router';
import Route from './Route';
import { IMountableItem, IOperationVariable, IOpenApiOptions, IGlobalConfiguration } from './types';

interface IParameter {
  name: string;
  required: boolean;
  in: string;
  type?: string;
  schema?: IParameterArraySchema | IParameterItemTypeOrRef;
  default?: string | boolean | number;
}

interface IParameterArraySchema {
  type: string;
  items: IParameterItemTypeOrRef;
}

interface IParameterItemTypeOrRef {
  type?: string;
  $ref?: string;
}

interface IBuildParametersArguments {
  variableDefinitions: IOperationVariable[];
  variableLocation: string;
  refLocation: string;
}

const PATH_VARIABLES_REGEX = /:([A-Za-z]+)/g;

function resolveBodySchemaName(route: Route): string {
  return `${route.operationName}Body`;
}

function translateScalarType(scalarType: string): string {
  switch (scalarType) {
    case 'Int':
      return 'number';
    case 'Boolean':
      return 'boolean';
    case 'String':
    default:
      return 'string';
  }
}

function buildScalarDefinition(node: any): any {
  const scalarType = translateScalarType(node.name);

  const scalarDoc: any = {
    type: scalarType,
  };

  if (node.description) {
    scalarDoc.description = node.description;
  }

  return scalarDoc;
}

function buildObjectDefinition(node: any): any {
  const objectDoc: any = {};

  objectDoc.type = 'object';
  objectDoc.properties = {};

  if (node.inputFields) {
    node.inputFields.forEach((field: any) => {
      const { type: fieldNode } = field;

      objectDoc.properties[field.name] = buildDefinition(fieldNode);
    });
  }

  return objectDoc;
}

function buildBodyDefinition(variables: IOperationVariable[], refLocation: string): any {
  const bodyDoc: any = {};

  bodyDoc.type = 'object';
  bodyDoc.properties = {};

  variables.forEach((field: IOperationVariable) => {
    bodyDoc.properties[field.name] = buildSchemaParameter(field, refLocation);
  });

  return bodyDoc;
}

function buildDefinition(node: any): any {
  switch (node.kind) {
    case 'INPUT_OBJECT':
      return buildObjectDefinition(node);
    case 'ENUM':
      return buildEnumDefinition(node);
    case 'SCALAR':
    default:
      return buildScalarDefinition(node);
  }
}

function buildEnumDefinition(node: any): any {
  const enumDoc: any = {
    type: 'string',
    enum: [],
  };

  if (node.description) {
    enumDoc.description = node.description;
  }

  node.enumValues.forEach((enumValue: any) => {
    enumDoc.enum.push(enumValue.name);
  });

  return enumDoc;
}

function openApiPath(path: string): string {
  return path.replace(PATH_VARIABLES_REGEX, '{$1}');
}

function buildSchemaParameter(
  variableDefinition: IOperationVariable,
  refLocation: string
): IParameterArraySchema | IParameterItemTypeOrRef {
  if (variableDefinition.array) {
    return {
      type: 'array',
      items: {
        '$ref': `${refLocation}/${variableDefinition.type}`
      },
    };
  }

  return {
    '$ref': `${refLocation}/${variableDefinition.type}`
  };
}

// TODO: Return Type and Attempt to get description from graphql
function buildParametersArray(
  { variableDefinitions, variableLocation, refLocation } : IBuildParametersArguments
): IParameter[] {
  return variableDefinitions.map(
    (variableDefinition: IOperationVariable): IParameter => ({
      name: variableDefinition.name,
      required: variableDefinition.required,
      in: variableLocation,
      schema: buildSchemaParameter(variableDefinition, refLocation),
      // default: variableDefinition.defaultValue,
    })
  );
}

class MountableDocument implements IMountableItem {
  public path = '/docs/openapi';
  public httpMethod = 'get';

  protected router?: Router;

  constructor(protected options: IOpenApiOptions) {
  }

  onMount(router: Router): this {
    this.router = router;

    return this;
  }

  at(path: string): this {
    this.path = path;

    return this;
  }

  protected async generateDocumentation(): Promise<string> {
    return '';
  }

  // Not currently used
  withOptions(options: IGlobalConfiguration): this {
    return this;
  }

  asExpressRoute(): ((req: express.Request, res: express.Response) => void) | never {
    const generateDoc = this.generateDocumentation();

    return async (req: express.Request, res: express.Response) => {
      const doc = await generateDoc;

      res
        .status(200)
        .json(doc);
    };
  }

  asKoaRoute(): ((req: express.Request, res: express.Response) => void) | never {
    throw new Error('not yet implemented');
  }

  asMetal(): ((req: express.Request, res: express.Response) => void) | never {
    throw new Error('not yet implemented');
  }

  protected getRouter(): Router {
    const { router } = this;

    if (!router) {
      throw new Error(`
        Router must be set in order to generate documentation. If you are using router.mount(), the router will automatically be set.
        If you are using this outside of a Router instance, please leverage #setRouter() to select a class that adheres to the router
        interface.
      `);
    }

    return router;
  }
}

export class V2 extends MountableDocument {
  public path = '/docs/swagger';

  protected async generateDocumentation(): Promise<any> {
    const router = this.getRouter();

    try {
      const {
        title,
        version,
        termsOfService,
        license,
        host,
        basePath,
      } = this.options;

      const page: any = {
        swagger: '2.0',
        info: {},
        paths: {},
        produces: ['application/json'],
        definitions: {},
      };

      page.info.title = title;
      page.info.version = version;

      if (termsOfService) {
        page.info.termsOfService = termsOfService;
      }

      if (license) {
        page.info.license = { name: license };
      }

      if (host) {
        page.host = host;
      }

      if (basePath) {
        page.basePath = basePath;
      }

      router.routes.forEach((route) => {
        const { path, httpMethod } = route;

        const docPath = openApiPath(path);

        if (!page.paths[docPath]) {
          page.paths[docPath] = {};
        }

        const routeDoc: any = page.paths[docPath][httpMethod] = {};

        routeDoc.parameters = [];
        routeDoc.consumes = [];
        routeDoc.produces = ['application/json'];
        routeDoc.responses = {
          200: {
            description: 'Server alive. This does not mean that the query was completed succesfully. Check the errors object in the response',
          },
          400: {
            description: 'Authentication Required',
          },
          500: {
            description: 'Server error.',
          }
        };

        if (httpMethod === 'post') {
          routeDoc.consumes.push('application/json');
        }

        // TODO: 'push in parameters for header'

        routeDoc.parameters.push(
          ...buildParametersArray({
            variableDefinitions: route.queryVariables,
            variableLocation: 'query',
            refLocation: '#/definitions',
          })
        );

        routeDoc.parameters.push(
          ...buildParametersArray({
            variableDefinitions: route.pathVariables,
            variableLocation: 'path',
            refLocation: '#/definitions',
          })
        );

        routeDoc.parameters.push(
          ...buildParametersArray({
            variableDefinitions: route.bodyVariables,
            variableLocation: 'body',
            refLocation: '#/definitions',
          })
        );
      });

      const introspectedVariableDefinitions: any = await describeRouteVariables(router);

      Object.keys(introspectedVariableDefinitions).forEach((variableName) => {
        const variableDefinition: any = introspectedVariableDefinitions[variableName];

        page.definitions[variableName] = buildDefinition(variableDefinition);
      });

      return page;
    } catch (error) {
      return {
        error: error.message,
      };
    }
  }
}

export class V3 extends MountableDocument {
  protected async generateDocumentation(): Promise<any> {
    const { options } = this;

    const doc: any = {};
    const refLocation = '#/components/schemas';

    doc.openapi = '3.0.0';
    doc.info = {};
    doc.info.title = options.title;
    doc.info.version = options.version;

    doc.paths = {};
    doc.components = {};

    if (options.license) {
      doc.license = {};
      doc.license.name = options.license;
    }

    if (options.host) {
      doc.servers = [];

      doc.servers.push({
        url: `${options.host}${options.basePath || ''}`,
      });
    }

    const router = this.getRouter();

    router.routes.forEach((route) => {
      const { path, httpMethod } = route;

      const docPath = openApiPath(path);

      if (!doc.paths[docPath]) {
        doc.paths[docPath] = {};
      }

      const routeDoc: any = doc.paths[docPath][httpMethod] = {};

      routeDoc.responses = {};

      routeDoc.responses.default = {};
      routeDoc.responses.default.description = 'OK';

      routeDoc.parameters = [];

      routeDoc.parameters.push(
        ...buildParametersArray({
          variableDefinitions: route.queryVariables,
          variableLocation: 'query',
          refLocation,
        })
      );

      routeDoc.parameters.push(
        ...buildParametersArray({
          variableDefinitions: route.pathVariables,
          variableLocation: 'path',
          refLocation,
        })
      );

      if (route.bodyVariables.length) {
        const schemaName = resolveBodySchemaName(route);

        routeDoc.requestBody = {
          content: {
            'application/json': {
              schema: {
                '$ref': `${refLocation}/${schemaName}`
              },
            },
          },
        };
      }
    });

    doc.components = {};
    doc.components.schemas = {};

    try {
      const introspectedVariableDefinitions: any = await describeRouteVariables(router);

      Object.keys(introspectedVariableDefinitions).forEach((variableName) => {
        const variableDefinition: any = introspectedVariableDefinitions[variableName];

        doc.components.schemas[variableName] = buildDefinition(variableDefinition);
      });

      // Build out definitions for each route to contain a "body" schema in case it's used
      // for anything besides GET
      router.routes.forEach(
        (route) => {
          const schemaName = resolveBodySchemaName(route);

          doc.components.schemas[schemaName] =
            buildBodyDefinition(route.bodyVariables, refLocation);
        }
      );

      return doc;
    } catch (error) {
      return {
        error: error.message,
      };
    }

  }
}
