import GraphQLRestRouter from 'graphql-rest-router';
import fs from 'fs';

const ENDPOINT = 'http://examplegraphql.com';
const SCHEMA = fs.readFileSync(`${__dirname}/schema.graphql`, 'utf8');

const api = new GraphQLRestRouter(ENDPOINT, SCHEMA);

api.mount('GetUserById').at('/user/:id');
api.mount('GetUserByEmail').disableCache();

export default api.asExpressRouter();
