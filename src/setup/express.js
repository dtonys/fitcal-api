import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import serializeError from 'serialize-error';

import routes from 'setup/routes';
import { renderEmail } from 'email/mailer';
import { STRIPE_WEBHOOK_ENDPOINT } from 'helpers/stripeWebhook';
import Raven from 'raven';


// NOTE: We're going to override the default express middleware
function handleErrorMiddleware( err, req, res, next ) { // eslint-disable-line no-unused-vars
  // NOTE: Add additional error processing here
  console.error('handleErrorMiddleware'); // eslint-disable-line no-console
  console.error(err); // eslint-disable-line no-console

  // In production, hide the error, return a generic `internal_server_error` response
  if ( process.env.NODE_ENV === 'production' ) {
    res.status(500);
    res.json({
      internal_server_error: true,
    });
    return;
  }
  // In development, expose the error details to the client
  res.status(500);
  res.json({
    internal_server_error: true,
    ...serializeError(err),
  });
}

export function createExpressApp() {
  // express
  const app = express();

  // middleware
  if ( process.env.NODE_ENV === 'production' ) {
    app.use(Raven.requestHandler());
  }
  app.use(helmet.hidePoweredBy());
  app.use(compression());
  app.use(cookieParser());
  app.use(bodyParser.json({
    // Because Stripe needs the raw body, we compute it but only when hitting the Stripe callback URL.
    verify: (req, res, buf) => {
      const url = req.originalUrl;
      if (url.startsWith(STRIPE_WEBHOOK_ENDPOINT)) {
        req.rawBody = buf.toString();
      }
    },
  }));
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(morgan('[:date[iso]] :method :url :status :response-time ms - :res[content-length]'));

  // api routes
  app.use(routes);

  // Preview emails
  app.use('/email/:mailName', renderEmail);

  // Catch all 404
  app.all('*', (req, res) => {
    res.status(404);
    res.send('API not found.');
  });

  // Handle errors
  if ( process.env.NODE_ENV === 'production' ) {
    app.use(Raven.errorHandler());
  }
  app.use(handleErrorMiddleware);

  return app;
}

export function startExpressServer( app, port = process.env.API_PORT ) {
  return new Promise((resolve, reject) => {
    const listener = app.listen(port, (err) => {
      if ( err ) {
        reject(err);
      }
      console.log(`API server listening on ${process.env.API_PORT} in ${app.settings.env} mode.`); // eslint-disable-line no-console
      resolve(listener);
    });
  });
}
