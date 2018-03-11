const stripe = require('stripe')(process.env.STRIPE_API_SECRET);

export function verifyStripeSignature( req, res, next ) { // eslint-disable-line
  const sig = req.headers[ 'stripe-signature' ];
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET );
    req.stripeWebhookEvent = event;
    next();
  }
  catch (err) {
    res.status(400).end();
  }
}
