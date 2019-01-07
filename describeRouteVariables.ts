import Router from './Router';
import Route from './Route';

const TYPE_FRAGMENT = `
  fragment TypeFragment on __Type {
    ...InputField
    inputFields {
      name
      type {
        ...InputField
        inputFields {
          name
          type {
            ...InputField
          }
        }
      }
    }
  }

  fragment InputField on __Type {
    kind
    name
    description
    enumValues {
      name
      description
    }
  }
`;

function buildQueryForVariable(variableName: string): string {
  return `
		${variableName}: __type(name: "${variableName}") {
			...TypeFragment
		}
  `;
}

function buildIntrospectionQuery(variables: string[]): string {
  return `
    query IntrospectionTypeQuery {
      ${variables.map(buildQueryForVariable).join('\n')}
    }

    ${TYPE_FRAGMENT}
  `;
}

function getAllUsedVariables(routes: Route[]): string[] {
  const variables: string[] = ([] as string[]).concat(
    ...routes.map(
      route => route.operationVariables.map(
        variable => variable.type
      )
    )
  );

  const uniqueVariables: string[] = [...new Set(variables)];

  return uniqueVariables;
}

export default async function describeRouteVariables(router: Router): Promise<any> {
  const variables = getAllUsedVariables(router.routes);
  const query = buildIntrospectionQuery(variables);

  try {
    const response = await router.axios({
      data: {
        query,
      }
    });

    return response.data.data;
  } catch (error) {
    console.error(`
      There was an issue connecting to GraphQL to generate documentation.
      Please ensure your connection string is correct and that any required proxies
      have been applied.
    `);

    throw error;
  }
}
