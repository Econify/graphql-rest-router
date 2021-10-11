import {
  DocumentNode,
  FieldNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  parse,
  print,
  SelectionNode,
  getOperationAST,
  FragmentDefinitionNode,
} from 'graphql';

function traverseAndBuildOptimizedQuery(
  schema: DocumentNode,
  operationName: string
): DocumentNode {
  const resultMap: { [k: string]: string } = {};

  function getFragmentSchema(fragmentName: string) {
    const fragmentSchema = schema.definitions.find((definition) =>
      definition.kind === 'FragmentDefinition' && definition.name.value === fragmentName);

    return fragmentSchema as FragmentDefinitionNode;
  }

  function findFragments(selections: readonly SelectionNode[]) {
    selections.forEach((selection: SelectionNode) => {
      const { kind } = selection;

      if (kind === 'FragmentSpread') {
        const { name: { value } } = selection as FragmentSpreadNode;

        if (!resultMap[value]) {
          const fragmentSnippet = getFragmentSchema(value);

          if (fragmentSnippet) {
            resultMap[value] = print(fragmentSnippet);
          }

          if (fragmentSnippet?.selectionSet?.selections?.length) {
            findFragments(fragmentSnippet.selectionSet.selections);
          }
        }
      }

      const { selectionSet } = selection as FieldNode | InlineFragmentNode;

      if (selectionSet?.selections?.length) {
        findFragments(selectionSet.selections);
      }
    });
  }

  const operationAST = getOperationAST(schema, operationName);

  if (!operationAST?.selectionSet?.selections?.length) {
    return schema;
  }

  findFragments(operationAST.selectionSet.selections);

  const optimizedSchema = `${Object.values(resultMap).join(' \n ')} \n ${print(operationAST)}`;

  return parse(optimizedSchema);
}

export default traverseAndBuildOptimizedQuery;

