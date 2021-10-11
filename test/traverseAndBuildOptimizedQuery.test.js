const graphql = require('graphql');
const { assert } = require('chai');
const fs = require('fs');

const { print, parse } = graphql;

const traverseAndBuildOptimizedQuery = require('../src/traverseAndBuildOptimizedQuery').default;
const schema = fs.readFileSync(`${__dirname}/schema.example.graphql`, 'utf8');

describe('traverseAndBuildOptimizedQuery', () => {
  it('returns original full parsed schema if no FragmentDefinitions are found', () => {
    const bareSchema = `
      query GetLocations {
        locations {
          name
        }
      }
    `;

    const parsedSchema = parse(bareSchema);
    const result = traverseAndBuildOptimizedQuery(parsedSchema, 'GetLocations');
    assert.equal(print(result), print(parsedSchema))
  });

  it('properly returns all fragments required for query', () => {
    const parsedSchema = parse(schema);
    const result = traverseAndBuildOptimizedQuery(parsedSchema, 'GetEpisodes');
    const { definitions } = result;
    const expectedFragments = ['info', 'episode', 'location', 'character'];

    expectedFragments.forEach((expectedFragment) => {
      const fragmentFound = definitions.some(definition => definition.name.value === expectedFragment);
      assert.equal(fragmentFound, true);
    })

    assert.equal(definitions.length, expectedFragments.length + 1); //  +1 is the named query definition
  });
});
