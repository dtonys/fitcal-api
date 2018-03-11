import { handleAsyncError } from 'helpers/express';
import Subscription, { isSubscribed } from 'models/subscription';
import StripeWebhook from 'models/stripe_webhook';
import InvoicePayment from 'models/invoice_payment';
import User from 'models/user';
import slackMessage from 'services/slackMessage';
import { WEBHOOK_EVENT_TYPES } from 'helpers/stripeWebhook';
const stripe = require('stripe')(process.env.STRIPE_API_SECRET);


// Update a user's subscription status
const syncSubscriptionStatus = async ( event ) => {
  const { id, status, customer } = event.data.object;
  const [ subscription, user ] = await Promise.all([
    Subscription.findOne({ stripe_subscription_id: id }),
    User.findOne({ stripe_customer_id: customer }),
  ]);
  subscription.status = status;
  user.subscribed = isSubscribed(status);
  await Promise.all([
    subscription.save(),
    user.save(),
  ]);
};

// Create a record of every invoice payment
const createInvoiceRecord = async ( event ) => {
  const {
    id, total, charge, customer,
  } = event.data.object;

  try {
    const chargeObj = await stripe.charges.retrieve(charge, { expand: [ 'balance_transaction' ] });
    const user = await User.findOne({ stripe_customer_id: customer });
    const invoice = await stripe.invoices.retrieve(id);
    const subId = invoice.lines.data.filter(( line ) => ( line.type === 'subscription' ))[0].id;
    const subscription = Subscription.find({ stripe_subscription_id: subId });

    await InvoicePayment.create({
      _id: id,
      amount: total,
      fee_amount: chargeObj.balance_transaction.fee,
      user: user._id,
      subscription: subscription._id,
    });
  }
  catch ( error ) {
    // IGNORE EXCEPTION
  }

};

export const stripeWebhook = handleAsyncError( async ( req, res ) => { // eslint-disable-line
  const event = req.stripeWebhookEvent;

  // Do not process test events in production
  if ( process.env.NODE_ENV === 'production' && !event.livemode ) return;

  // relay webhook event to slack
  slackMessage( `${event.type} - https://dashboard.stripe.com/test/events/${event.id}`);

  // exit if webhook event is not a type we care about
  if ( WEBHOOK_EVENT_TYPES.indexOf( event.type ) === -1 ) return;

  // Do not process the same event more than once
  const exists = await StripeWebhook.count({ _id: event.id });
  if ( exists ) return;
  await StripeWebhook.create({ _id: event.id });

  /* Process webhooks, based on type */
  // Update subscription status whenever it changes
  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  ) {
    await syncSubscriptionStatus(event);
  }
  // Record successful invoice payments, for basic payment reporting
  if ( event.type === 'invoice.payment_succeeded' ) {
    createInvoiceRecord(event);
  }

  // Always return 200 success response
  res.sendStatus(200);
});
