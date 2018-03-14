const stripe = require('stripe')(process.env.STRIPE_API_SECRET);


export const STRIPE_WEBHOOK_ENDPOINT = '/api/stripe/webhook';
export const WEBHOOK_EVENT_TYPES = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
];

// Add the raw text body of the request to the `request` object
export function addRawBody(req, res, next) {
  req.setEncoding('utf8');

  let data = '';

  req.on('data', (chunk) => {
    data += chunk;
  });

  req.on('end', () => {
    req.rawBody = data;
    next();
  });
}

export function verifyStripeSignature( req, res, next ) { // eslint-disable-line
  const sig = req.headers[ 'stripe-signature' ];
  try {
    const event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET );
    req.stripeWebhookEvent = event;
    next();
  }
  catch (err) {
    res.status(400).end();
  }
}
