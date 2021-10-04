#!/bin/sh

# Set current shell location to here so can be
# run via parent npm run live-test or from current directory
cd "$(dirname "$0")" || exit 1

#  Build graphql rest router
cd ../

echo "Building rest router"

# npm install only if graphql-rest-routers node_modules are not found
if [ -d "node_modules" ]
then
    echo "Node modules exist."
else
    echo "Node modules do not exist in parent. Installing all dependencies."
    npm install
fi

if [ -d "build" ]
then
    echo "Build exists, skipping"
else
    echo "Building..."
    npm run build
fi

echo 'Completed build'

# build this example application
cd example-consuming-client || exit 1

if [ -d "node_modules" ]
then
    echo "Node modules exist. Just installing rest router."
else
    echo "Node modules does not exist. Installing all dependencies."
    npm install
fi

npm install ../build

npm run start
