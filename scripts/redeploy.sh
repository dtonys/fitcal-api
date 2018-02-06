#!/bin/sh
cd ~/webapps/fitcal-api
git pull origin master
yarn
npm run build
forever restart fitcal-api

