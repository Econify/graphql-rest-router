#  Build graphql rest router
cd ../
# npm ci
npm run prepare

echo 'COMPLETED REST ROUTER BUILD'

# build this application
cd ./example-consuming-client

if [ -d "./node_modules" ] 
then
    echo "Node modules exist. Just installing rest router."
else
    echo "Node modules does not exist. Installing all dependencies."
    npm install
fi

npm install ../build

npm run start
