# Client for testing rest router

### Overview
This is a test application for graphql rest router.
Currently it uses an open source live Rick and Morty api but
in a future iteration we will write a small api and containerize the whole test.

### Usage
From parent directory, simply run:
`
npm run live-test
`

OR
From this directory, simply run:
`
bash build.sh
`

The server will be exposed on `localhost:4000` and can be hit at any of the paths found in `example-consuming-client/src/lib/api` -- some examples being:

```
http://localhost:4000/api/characters
http://localhost:4000/api/characters/:id
http://localhost:4000/api/episodes
http://localhost:4000/api/episodes/:id
http://localhost:4000/api/locations
http://localhost:4000/api/locations/:id
```

### Future TODOs:
* Remove Rick and Morty api and add small api for reliability
* Containerize both this example app and the above mentioned api so testing can be done with `docker-compose up`
* Ensure all major features from `graphql-rest-router` are being utilized in this example app