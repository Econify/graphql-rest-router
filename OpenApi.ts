import IMountableItem from './IMountableItem';
import Router from './Router';
import Route, { IOperationVariable } from './Route';
import express from 'express';

interface IParameter {
  name: string;
  required: boolean;
  in: string;
  type: string;
  default?: string | boolean | number;
}

interface IBuildParametersArguments {
  variableDefinitions: IOperationVariable[];
  variableLocation: string;
}

const PATH_VARIABLES_REGEX = /:([A-Za-z]+)/g

function openApiPath(path: string): string {
  return path.replace(PATH_VARIABLES_REGEX, '{$1}');
}

// TODO: Return Type and Attempt to get description from graphql
function buildParametersArray({ variableDefinitions, variableLocation }: IBuildParametersArguments): IParameter[] {
  return variableDefinitions.map(
    (variableDefinition: IOperationVariable): IParameter => ({
      name: variableDefinition.name,
      required: variableDefinition.required,
      default: variableDefinition.defaultValue,
      in: variableLocation,
      type: variableDefinition.type,
    })
  );
}

export class V2 implements IMountableItem {
  public path: string = '/docs/openapi/v2';
  public httpMethod: string = 'get';

  constructor(options: any, private router?: Router) {
  }

  setRouter(router: Router): this {
    this.router = router;

    return this;
  }

  at(path: string): this {
    this.path = path;

    return this;
  }

  private generateDocumentation(): any {
    const { router } = this;

    if (!router) {
      throw new Error(`
        Router must be set in order to generate documentation. If you are using router.mount(), the router will automatically be set.
        If you are using this outside of a Router instance, please leverage #setRouter() to select a class that adheres to the router
        interface.
      `);
    }

    const page: any = {
      swagger: '2.0',
      info: {},
      paths: {},
    };

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

    return page;
  }

  withOptions(options: {}): this {
    return this;
  }

  asExpressRoute(): (req: express.Request, res: express.Response) => void {
    const doc = this.generateDocumentation();

    return (req: express.Request, res: express.Response) => {
      res
        .status(200)
        .json(doc);
    }
  }

  asKoaRoute() {
    throw new Error('not yet implemented');
  }

  asMetal() {
    throw new Error('not yet implemented');
  }
}
