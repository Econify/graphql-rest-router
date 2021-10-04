import GraphQLRestRouter, { OpenApi, InMemoryCache } from 'graphql-rest-router';
import SCHEMA from './schema';

const { ENDPOINT = '' } = process.env;

const api = new GraphQLRestRouter(ENDPOINT, SCHEMA, {
  cacheEngine: InMemoryCache,
});

const documentation = new OpenApi.V2({
  title: 'My REST API', // REQUIRED!
  version: '1.0.0',     // REQUIRED!

  host: 'http://localhost:4000',
  basePath: '/api',
});

api.mount('GetCharacters').at('/characters/');
api.mount('GetCharacterById').at('/characters/:id');

api.mount('GetLocations').at('/locations').transformResponse(response => {
  const json = JSON.parse(response);
  const { data, errors } = json;

  return {
    data: {
      isTransformed: true,
      ...data,
      errors,
    }
  };
});

api.mount('GetLocationById').at('/locations/:id');

api.mount('GetEpisodes').at('episodes');
api.mount('GetEpisodeById').at('episodes/:id');

api.mount(documentation).at('/docs/openapi');

export default api.asExpressRouter();
