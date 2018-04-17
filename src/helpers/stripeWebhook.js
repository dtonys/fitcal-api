const stripe = require('stripe')(process.env.STRIPE_API_SECRET);


export const STRIPE_WEBHOOK_ENDPOINT = '/api/stripe/webhook';
export const STRIPE_CONNECT_WEBHOOK_ENDPOINT = '/api/stripe/connect/webhook';
export const WEBHOOK_EVENT_TYPES = [
  // 'customer.subscription.created',
  // 'customer.subscription.updated',
  // 'customer.subscription.deleted',
  // 'invoice.payment_succeeded',
  // Connected user disconnects from service
  'account.application.deauthorized',
];

export function verifyStripeSignature( req, res, next ) { // eslint-disable-line
  const sig = req.headers[ 'stripe-signature' ];
  try {
    const event = stripe.webhooks.constructEvent(req.rawBody, sig, req.stripeWebhookSecret );
    req.stripeWebhookEvent = event;
    next();
  }
  catch (err) {
    console.log('verifyStripeSignature failed');
    console.log(err);
    res.status(400).end();
  }
}
