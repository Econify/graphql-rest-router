import IMountableItem from './IMountableItem';
import describeRouteVariables from './describeRouteVariables';
import Router from './Router';
import Route, { IOperationVariable } from './Route';
import express from 'express';

interface IOpenApiOptions {
  title: string;
  version: string;
  termsOfService?: string;
  license?: string;
  basePath?: string;
  host?: string;
}

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
}

const PATH_VARIABLES_REGEX = /:([A-Za-z]+)/g

function openApiPath(path: string): string {
  return path.replace(PATH_VARIABLES_REGEX, '{$1}');
}

function resolveRefOrType(variableType: string): IParameterItemTypeOrRef {
  switch (variableType) {
    case 'String':
      return { type: 'string' };
    case 'Boolean':
      return { type: 'boolean' };
    case 'Int':
      return { type: 'number' };
    default:
      return { '$ref': `#/definitions/${variableType}` };
  }
}

// TODO: Return Type and Attempt to get description from graphql
function buildParametersArray({ variableDefinitions, variableLocation }: IBuildParametersArguments): IParameter[] {
  return variableDefinitions.map(
    (variableDefinition: IOperationVariable): IParameter => {
      const parameter: IParameter = {
        name: variableDefinition.name,
        required: variableDefinition.required,
        default: variableDefinition.defaultValue,
        in: variableLocation,
      };

      if (variableDefinition.array) {
        parameter.schema = {
          type: 'array',
          items: resolveRefOrType(variableDefinition.type),
        };
      } else {
        const refOrType = resolveRefOrType(variableDefinition.type);
        
        if (refOrType.type) {
          parameter.type = refOrType.type;
        } else {
          parameter.schema = refOrType;
        }
      }

      return parameter;
    }
  );
}

export class V2 implements IMountableItem {
  public path: string = '/docs/openapi/v2';
  public httpMethod: string = 'get';

  constructor(private options: IOpenApiOptions, private router?: Router) {
  }

  setRouter(router: Router): this {
    this.router = router;

    return this;
  }

  at(path: string): this {
    this.path = path;

    return this;
  }

  private async generateDocumentation(): Promise<any> {
    const { router } = this;

    if (!router) {
      throw new Error(`
        Router must be set in order to generate documentation. If you are using router.mount(), the router will automatically be set.
        If you are using this outside of a Router instance, please leverage #setRouter() to select a class that adheres to the router
        interface.
      `);
    }

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
            variableLocation: 'query'
          })
        );

        routeDoc.parameters.push(
          ...buildParametersArray({
            variableDefinitions: route.pathVariables,
            variableLocation: 'path'
          })
        );

        routeDoc.parameters.push(
          ...buildParametersArray({
            variableDefinitions: route.bodyVariables,
            variableLocation: 'body'
          })
        );
      });

      const introspectedVariableDefinitions: any = await describeRouteVariables(router);

      Object.keys(introspectedVariableDefinitions).forEach((variableName) => {
        const variableDefinition: any = introspectedVariableDefinitions[variableName];

        const definitionDoc: any = page.definitions[variableName] = {};

        if (variableDefinition.kind === 'INPUT_OBJECT') {
          definitionDoc.type = 'object';
          definitionDoc.properties = {};

          variableDefinition.inputFields.forEach((field: any) => {
            const inputDoc: any = definitionDoc.properties[field.name] = {};

            inputDoc.type = 'string';
            inputDoc.description = field.type.description;

            if (field.type.kind === 'ENUM') {
              inputDoc.enum = [];

              field.type.enumValues.forEach((enumValue: any) => {
                inputDoc.enum.push(enumValue.name);
              });
            }
          });
        }

        if (variableDefinition.kind === 'ENUM') {
          definitionDoc.type = 'string';
          definitionDoc.enum = [];

          variableDefinition.enumValues.forEach((enumValue: any) => {
            definitionDoc.enum.push(enumValue.name);
          });
        }
      });

      return page;
    } catch (error) {
      return {
        error: error.message,
      };
    }
  }

  withOptions(options: {}): this {
    return this;
  }

  asExpressRoute(): (req: express.Request, res: express.Response) => void {
    const generateDoc = this.generateDocumentation();

    return (req: express.Request, res: express.Response) => {
      generateDoc.then(
        (doc) => {
          res
            .status(200)
            .json(doc);
        }
      );
    }
  }

  asKoaRoute() {
    throw new Error('not yet implemented');
  }

  asMetal() {
    throw new Error('not yet implemented');
  }
}
