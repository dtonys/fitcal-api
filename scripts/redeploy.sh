#!/bin/sh
cd ~/webapps/node-api-boilerplate
git pull origin master
npm i
npm run build
forever restart node-api
