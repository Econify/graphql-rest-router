const graphql = require('graphql');
const { assert } = require('chai');

const { print, parse } = graphql;

const traverseAndBuildOptimizedQuery = require('../src/traverseAndBuildOptimizedQuery').default;

const schema = `
  fragment info on Info {
    count
    pages
    next
    prev
  }

  fragment location on Location {
    id
    name
    residents {
      ...character
    }
  }

  fragment character on Character {
    id
    name
    origin {
      ...location
    }
  }

  fragment episode on Episode {
    id
    name
    air_date
    episode
    created
    characters {
      ...character
    }
  }

  query GetCharacterById($id: ID!) {
    character(id: $id) {
      ...character
    }
  }

  query GetCharacters {
    characters {
      info {
        ...info
      }
      results {
        ...character
      }
    }
  }

  query GetLocationById($id: ID!) {
    location(id: $id) {
      ...location
    }
  }

  query GetLocations {
    locations {
      info {
        ...info
      }
      results {
        ...location
      }
    }
  }

  query GetEpisodeById($id: ID!) {
    episode(id: $id) {
      ...episode
    }
  }

  query GetEpisodes {
    episodes {
      info {
        ...info
      }
      results {
        ...episode
      }
    }
  }
`;


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
