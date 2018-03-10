import { handleAsyncError } from 'helpers/express';
import {
  getCurrentUser,
} from 'models/session';
import Subscription, { subscribeToPlatform } from 'models/subscription';
const stripe = require('stripe')(process.env.STRIPE_API_SECRET);


export const platformSubscribe = handleAsyncError( async ( req, res ) => {
  const { token } = req.body;
  // get current user
  const currentUser = await getCurrentUser( req );
  const subcription = await subscribeToPlatform( currentUser, token );
  res.json({
    data: subcription,
  });
});

export const platformUnSubscribe = handleAsyncError( async ( req, res ) => {
  // get current user
  const currentUser = await getCurrentUser( req );
  const subscription = await Subscription.findOne({
    user: currentUser._id,
  });
  await subscription.cancelPlatformSubscription();
  res.json({
    data: null,
  });
});

export const getPaymentMethod = handleAsyncError( async ( req, res ) => {
  const currentUser = await getCurrentUser( req );
  if ( !currentUser.stripe_customer_id ) {
    res.json({
      data: null,
    });
    return;
  }
  const customer = await stripe.customers.retrieve(
    currentUser.stripe_customer_id,
    { expand: [ 'default_source' ] },
  );
  res.json({
    data: customer.default_source,
  });
});

export const updatePaymentMethod = handleAsyncError( async ( req, res ) => {
  const { token } = req.body;
  const currentUser = await getCurrentUser( req );
  await stripe.customers.update(
    currentUser.stripe_customer_id,
    { source: token },
  );
  res.json({
    data: null,
  });
});

export const stripeWebhook = handleAsyncError( async ( req, res ) => {
  // verify stripe signature
  // req.stripeWebhookEvent
  console.log('req.stripeWebhookEvent');
  console.log(req.stripeWebhookEvent);
  console.log('req.body');
  console.log(req.body);

  // const event = req.body;
  // const eventMap = {
  //   'customer.subscription.deleted': '',
  //   'customer.subscription.updated': '',
  // };

  res.sendStatus(200);
  // process.env.STRIPE_WEBHOOK_SECRET;

  // filter already processed webhoos

  // add idempotency key

  // relay webhook event to slack

  // return 200 success response

});

export const create = handleAsyncError( async ( req, res ) => {
  res.json({
    name: 'membership: create',
  });
});

export const update = handleAsyncError( async ( req, res ) => {
  res.json({
    name: 'membership: update',
  });
});

export const remove = handleAsyncError( async ( req, res ) => {
  res.json({
    name: 'membership: remove',
  });
});

export const myMemberships = handleAsyncError( async ( req, res ) => {
  res.json({
    name: 'membership: myMemberships',
  });
});

export const mySubscriptions = handleAsyncError( async ( req, res ) => {
  res.json({
    name: 'membership: mySubscriptions',
  });
});

export const subscribe = handleAsyncError( async ( req, res ) => {
  res.json({
    name: 'membership: subscribe',
  });
});
