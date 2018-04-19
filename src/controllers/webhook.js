import { handleAsyncError } from 'helpers/express';
import StripeEvent from 'models/stripe_event';
// import InvoicePayment from 'models/invoice_payment';
import MembershipSubscription, {
  isSubscribed,
} from 'models/membership_subscription';
import User from 'models/user';
import slackMessage from 'services/slackMessage';
import * as mailer from 'email/mailer';
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
async function syncSubscriptionStatus( event ) {
  const { id, status, customer } = event.data.object;
  // fetch the subscription
  const subscription = await MembershipSubscription.findOne({ stripe_subscription_id: id });
  // fetch the customer user
  const customerUser = await User.findOne({
    'stripe_customer_references.stripe_customer_id': customer,
  });

  // update the subscription status
  subscription.status = status;
  await subscription.save();

  // update the user record
  const subscribed = isSubscribed(status);
  if ( !subscribed ) {
    await customerUser.update({
      $pull: { subscribed_memberships: subscription.membership },
    });
  }
  if ( subscribed ) {
    await customerUser.update({
      $addToSet: { subscribed_memberships: subscription.membership },
    });
  }
}

async function removeSubscription( event ) {
  const { id, customer } = event.data.object;
  // fetch the subscription
  const subscription = await MembershipSubscription.findOne({ stripe_subscription_id: id });
  // fetch the customer user
  const customerUser = await User.findOne({
    'stripe_customer_references.stripe_customer_id': customer,
  });
  // delete the subscription record
  await subscription.remove();
  // update the user record
  await customerUser.update({
    $pull: { subscribed_memberships: subscription.membership },
  });
}

async function removeCustomer( event ) {
  const { id } = event.data.object;
  // remove the customer reference from the user record
  await User.update(
    { 'stripe_customer_references.stripe_customer_id': id },
    { $pull: { stripe_customer_references: id } },
  );
}

async function disconnectUser( event ) {
  // update user record
  const user = await User.findOne({ _id: event.account });
  user.connected = false;
  user.stripe_connect_token = null;
  await user.save();
}

async function handleInvoicePaymentSuccess( event ) {
  const providerAccount =  event.account;
  const { customer } = event.data.object;

  const providerUser = await User.findOne({
    'stripe_connect_token.stripe_user_id': providerAccount,
  });
  const customerUser = await User.findOne({
    'stripe_customer_references.stripe_customer_id': customer,
  });
  await mailer.webhookEventJSON( providerUser.email, event );
  await mailer.webhookEventJSON( customerUser.email, event );
}

async function handleInvoicePaymentFailed( event ) {
  const providerAccount =  event.account;
  const { customer } = event.data.object;

  const providerUser = await User.findOne({
    'stripe_connect_token.stripe_user_id': providerAccount,
  });
  const customerUser = await User.findOne({
    'stripe_customer_references.stripe_customer_id': customer,
  });
  await mailer.webhookEventJSON( providerUser.email, event );
  await mailer.webhookEventJSON( customerUser.email, event );
}

async function handleSubscriptionCreated( event ) {
  const providerAccount =  event.account;
  const { customer } = event.data.object;

  const providerUser = await User.findOne({
    'stripe_connect_token.stripe_user_id': providerAccount,
  });
  const customerUser = await User.findOne({
    'stripe_customer_references.stripe_customer_id': customer,
  });
  await mailer.webhookEventJSON( providerUser.email, event );
  await mailer.webhookEventJSON( customerUser.email, event );
}

async function handleSubscriptionUpdated( event ) {
  await syncSubscriptionStatus( event );
}

async function handleSubscriptionDeleted( event ) {
  await removeSubscription( event );

  const providerAccount =  event.account;
  const { customer } = event.data.object;

  const providerUser = await User.findOne({
    'stripe_connect_token.stripe_user_id': providerAccount,
  });
  const customerUser = await User.findOne({
    'stripe_customer_references.stripe_customer_id': customer,
  });
  await mailer.webhookEventJSON( providerUser.email, event );
  await mailer.webhookEventJSON( customerUser.email, event );
}

async function handleCustomerDeleted( event ) {
  await removeCustomer( event );
}

async function handleCustomerSourceExpiring( event ) {
  const customerEmail = event.data.object.owner.email;
  await mailer.webhookEventJSON( customerEmail, event );
}

async function handleUserDisconnect( event ) {
  await disconnectUser( event );
  const providerAccount = event.account;

  const providerUser = await User.findOne({
    'stripe_connect_token.stripe_user_id': providerAccount,
  });
  await mailer.webhookEventJSON( providerUser.email, event );
}

async function handleChargeRefund( event ) {
  const providerAccount = event.account;
  const { customer } = event.data.object;

  const providerUser = await User.findOne({
    'stripe_connect_token.stripe_user_id': providerAccount,
  });
  const customerUser = await User.findOne({
    'stripe_customer_references.stripe_customer_id': customer,
  });
  await mailer.webhookEventJSON( providerUser.email, event );
  await mailer.webhookEventJSON( customerUser.email, event );
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
  const exists = await StripeEvent.count({ _id: event.id });
  if ( exists ) {
    res.sendStatus(200);
    return;
  }

  /* Process webhooks, based on type */

  // if event payload contains `account`, this is a connect event, so load that provider user
  if ( event.account ) {
    if ( event.type === 'invoice.payment_succeeded' ) {
      await handleInvoicePaymentSuccess( event );
    }
    if ( event.type === 'invoice.payment_failed' ) {
      await handleInvoicePaymentFailed( event );
    }
    if ( event.type === 'customer.subscription.created' ) {
      await handleSubscriptionCreated( event );
    }
    if ( event.type === 'customer.subscription.updated' ) {
      await handleSubscriptionUpdated( event );
    }
    if ( event.type === 'customer.subscription.deleted' ) {
      await handleSubscriptionDeleted( event );
    }
    if ( event.type === 'customer.deleted' ) {
      await handleCustomerDeleted( event );
    }
    if ( event.type === 'customer.source.expiring' ) {
      await handleCustomerSourceExpiring( event );
    }
    if ( event.type === 'account.application.deauthorized' ) {
      await handleUserDisconnect( event );
    }
    if ( event.type === 'charge.refunded' ) {
      await handleChargeRefund( event );
    }
  }

  // Create the resource after operations are successful ( TODO: UNDO )
  await StripeEvent.create({ _id: event.id });

  // Always return 200 success response
  res.sendStatus(200);
});
