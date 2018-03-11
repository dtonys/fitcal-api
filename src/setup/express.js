import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import { STRIPE_WEBHOOK_ENDPOINT } from 'helpers/stripeWebhook';
import routes from 'setup/routes';
import { renderEmail } from 'email/mailer';


function handleErrorMiddleware( err, req, res, next ) {
  // NOTE: Add additional error processing here
  console.log('handleErrorMiddleware'); // eslint-disable-line no-console
  console.log(err); // eslint-disable-line no-console
  // Pass to express' default error handler, which will return
  // `Internal Server Error` when `process.env.NODE_ENV === production` and
  // a stack trace otherwise
  next(err);
}

function handleUncaughtErrors() {
  process.on('uncaughtException', ( error ) => {
    // NOTE: Add additional error processing here
    console.log('uncaughtException'); // eslint-disable-line no-console
    console.log(error); // eslint-disable-line no-console
    process.exit(1);
  });
  // NOTE: Treat promise rejections the same as an uncaught error,
  // as both can be invoked by a JS error
  process.on('unhandledRejection', ( error ) => {
    // NOTE: Add additional error processing here
    console.log('unhandledRejection'); // eslint-disable-line no-console
    console.log(error); // eslint-disable-line no-console
    process.exit(1);
  });
}

export function createExpressApp() {
  // express
  const app = express();

  // middleware
  app.use(helmet.hidePoweredBy());
  app.use(compression());
  app.use(cookieParser());
  app.use(bodyParser.json({
    verify: ( req, res, buf ) => {
      const url = req.originalUrl;
      if ( url.startsWith(STRIPE_WEBHOOK_ENDPOINT) ) {
        req.rawBody = buf.toString();
      }
    },
  }));
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(morgan('[:date[iso]] :method :url :status :response-time ms - :res[content-length]'));

  // api routes
  app.use(routes);

  // Handle errors
  app.use(handleErrorMiddleware);

  // Preview emails
  app.use('/email/:mailName', renderEmail);

  // Catch all 404
  app.all('*', (req, res) => {
    res.status(404);
    res.send('API not found.');
  });
  return app;
}

export function startExpressServer( app, port = process.env.API_PORT ) {
  return new Promise((resolve, reject) => {
    const listener = app.listen(port, (err) => {
      if ( err ) {
        reject(err);
      }
      handleUncaughtErrors();
      console.log(`API server listening on ${process.env.API_PORT} in ${app.settings.env} mode.`); // eslint-disable-line no-console
      resolve(listener);
    });
  });
}
