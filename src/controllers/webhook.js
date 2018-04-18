import { handleAsyncError } from 'helpers/express';
import StripeEvent from 'models/stripe_event';
import InvoicePayment from 'models/invoice_payment';
import User from 'models/user';
import slackMessage from 'services/slackMessage';
// const stripe = require('stripe')(process.env.STRIPE_API_SECRET);


// List all webhook events that we care about
const WEBHOOK_EVENT_TYPES = [
  // An invoice payment (subscription) succeeds
  'invoice.payment_succeeded',
  // A invoice payment (subscription) fails
  'invoice.payment_failed',

  // A subscription is created
  'customer.subscription.created',
  // A subscription changes, potentially becoming active / inactive
  'customer.subscription.updated',
  // A subscription is deleted
  'customer.subscription.deleted',

  /** Events below are not a result of actions on the platform.
    They may be triggered via stripe dashboard or another external resource. **/

  // A customer gets deleted
  'customer.deleted',
  // A customer's credit card will expire at the end of the month
  'customer.source.expiring',
  // A provider disonnects from our platform
  'account.application.deauthorized',
  // A payment ( charge or invoice ) was refunded
  'charge.refunded',
];

// Update a user's subscription status
// const syncSubscriptionStatus = async ( event ) => {
//   const { id, status, customer } = event.data.object;
//   const [ subscription, user ] = await Promise.all([
//     Subscription.findOne({ stripe_subscription_id: id }),
//     User.findOne({ stripe_customer_id: customer }),
//   ]);
//   subscription.status = status;
//   user.subscribed = isSubscribed(status);
//   await Promise.all([
//     subscription.save(),
//     user.save(),
//   ]);
// };

// Create a record of every invoice payment
// const createInvoiceRecord = async ( event ) => {
//   const {
//     id, total, charge, customer,
//   } = event.data.object;

//   try {
//     const chargeObj = await stripe.charges.retrieve(charge, { expand: [ 'balance_transaction' ] });
//     const user = await User.findOne({ stripe_customer_id: customer });
//     const invoice = await stripe.invoices.retrieve(id);
//     const subId = invoice.lines.data.filter(( line ) => ( line.type === 'subscription' ))[0].id;
//     const subscription = Subscription.find({ stripe_subscription_id: subId });

//     await InvoicePayment.create({
//       _id: id,
//       amount: total,
//       fee_amount: chargeObj.balance_transaction.fee,
//       user: user._id,
//       subscription: subscription._id,
//     });
//   }
//   catch ( error ) {
//     // IGNORE EXCEPTION
//   }

// };

async function syncSubscriptionStatus() {
  // NOT_EMPTY
}

async function removeSubscription() {
  // NOT_EMPTY
}

async function removeCustomer() {
  // NOT_EMPTY
}

async function disconnectUser() {
  // NOT_EMPTY
}

async function handleInvoicePaymentSuccess(  ) {
  console.log('handleInvoicePaymentSuccess');
  // TODO: Send email if needed
}

async function handleInvoicePaymentFailed(  ) {
  console.log('handleInvoicePaymentFailed');
  // TODO: Send email if needed
}

async function handleSubscriptionCreated(  ) {
  console.log('handleSubscriptionCreated');
  // TODO: Send email if needed
}

async function handleSubscriptionUpdated(  ) {
  console.log('handleSubscriptionUpdated');
  // TODO: Send email if needed
  syncSubscriptionStatus();
}

async function handleSubscriptionDeleted(  ) {
  console.log('handleSubscriptionDeleted');
  removeSubscription();
}

async function handleCustomerDeleted(  ) {
  console.log('handleCustomerDeleted');
  removeCustomer();
}

async function handleCustomerSourceExpiring(  ) {
  console.log('handleCustomerSourceExpiring');
  // TODO: Send email if needed
}

async function handleUserDisconnect(  ) {
  console.log('handleUserDisconnect');
  disconnectUser();
}

async function handleChargeRefund(  ) {
  console.log('handleChargeRefund');
  // TODO: Send email if needed
}

export const stripeWebhook = handleAsyncError( async ( req, res ) => { // eslint-disable-line
  const event = req.stripeWebhookEvent;

  console.log(`webhook event: ${event.type}`);
  // Do not process test events in production
  if ( process.env.NODE_ENV === 'production' && !event.livemode ) return;

  // relay webhook event to slack
  slackMessage( `${event.type} - https://dashboard.stripe.com/test/events/${event.id}`);

  // return 200 and do nothing further, if webhook event is not a type we care about
  if ( !WEBHOOK_EVENT_TYPES.includes( event.type ) ) {
    res.sendStatus(200);
    return;
  }

  // TODO: UNDO
  // Do not process the same event more than once
  // const exists = await StripeEvent.count({ _id: event.id });
  // if ( exists ) {
  //   res.sendStatus(200);
  //   return;
  // }

  /* Process webhooks, based on type */

  // if event payload contains `account`, this is a connect event, so load that provider user
  if ( event.account ) {
    const instructor = await User.findOne({
      'stripe_connect_token.stripe_user_id': event.account,
    });

    if ( event.type === 'invoice.payment_succeeded' ) {
      await handleInvoicePaymentSuccess( instructor );
    }
    if ( event.type === 'invoice.payment_failed' ) {
      await handleInvoicePaymentFailed( instructor );
    }
    if ( event.type === 'customer.subscription.created' ) {
      await handleSubscriptionCreated( instructor );
    }
    if ( event.type === 'customer.subscription.updated' ) {
      await handleSubscriptionUpdated( instructor );
    }
    if ( event.type === 'customer.subscription.deleted' ) {
      await handleSubscriptionDeleted( instructor );
    }
    if ( event.type === 'customer.deleted' ) {
      await handleCustomerDeleted( instructor );
    }
    if ( event.type === 'customer.source.expiring' ) {
      await handleCustomerSourceExpiring( instructor );
    }
    if ( event.type === 'account.application.deauthorized' ) {
      await handleUserDisconnect( instructor );
    }
    if ( event.type === 'charge.refunded' ) {
      await handleChargeRefund( instructor );
    }
  }

  // Update subscription status whenever it changes
  // console.log('Processing: ' + event.type); // eslint-disable-line
  // if (
  //   event.type === 'customer.subscription.created' ||
  //   event.type === 'customer.subscription.updated' ||
  //   event.type === 'customer.subscription.deleted'
  // ) {
  //   await syncSubscriptionStatus(event);
  // }
  // // Record successful invoice payments, for basic payment reporting
  // if ( event.type === 'invoice.payment_succeeded' ) {
  //   createInvoiceRecord(event);
  // }

  // Create the resource after operations are successful ( TODO: UNDO )
  // await StripeEvent.create({ _id: event.id });

  // Always return 200 success response
  res.sendStatus(200);
});
