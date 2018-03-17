import path from 'path';
import dotenv from 'dotenv';
import Raven from 'raven';


function setupErrorHandling() {
  // setup sentry error reporting, only in production environment
  const ravenConfigUrl = process.env.NODE_ENV === 'production'
    ? process.env.SENTRY_CONFIG_URL
    : false;

  Raven.config(ravenConfigUrl).install();

  // Ensure that unhandledRejection is logged and exits the server
  process.on('unhandledRejection', (error) => {
    console.error('unhandledRejection'); // eslint-disable-line no-console
    console.error(error); // eslint-disable-line no-console
    Raven.captureException(error, ( /* sendErr, eventId */ ) => {
      process.exit(1);
    });
  });
}

async function bootstrap() {
  // load envs
  dotenv.load({
    path: path.resolve(__dirname, '../.env'),
  });

  // NOTE: Require env dependent files after envs are set
  const mailer = require('email/mailer');
  const { createExpressApp, startExpressServer } = require('setup/express');
  const { setupMongoose } = require('setup/mongodb');

  // setup mongodb
  await setupMongoose( process.env.MONGODB_DATABASE_NAME );
  mailer.initialize();

  // setup error logging
  setupErrorHandling();

  // setup express
  const expressApp = createExpressApp();
  await startExpressServer(expressApp);

}

bootstrap()
  .catch((error) => {
    console.error('bootstrap error'); // eslint-disable-line no-console
    console.error(error); // eslint-disable-line no-console
  });
