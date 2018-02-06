#!/bin/sh
cd ~/webapps/fitcal-api
git pull origin master
yarn
npm run build
npm run start
