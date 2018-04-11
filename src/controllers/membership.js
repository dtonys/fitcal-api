import superagent from 'superagent';
import { handleAsyncError } from 'helpers/express';
import Subscription, { subscribeToPlatform } from 'models/subscription';
import querystring from 'querystring';
import {
  SESSION_COOKIE_NAME,
  getCurrentSessionAndUser,
  getCurrentUser,
} from 'models/session';
import Membership from 'models/membership';
const stripe = require('stripe')(process.env.STRIPE_API_SECRET);


export const stripeConnect = handleAsyncError( async ( req, res ) => {
  const { currentUser, currentSession } = await getCurrentSessionAndUser( req.cookies[SESSION_COOKIE_NAME] );
  // Generate a random string as state to protect from CSRF and place it in the session.
  const csrfState = Math.random().toString(36).slice(2);
  currentSession.stripeConnectCSRFState = csrfState;
  await currentSession.save();

  const parameters = {
    client_id: process.env.STRIPE_CONNECT_CLIENT_ID,
    state: csrfState,
    'stripe_user[email]': currentUser.email,
    'stripe_user[first_name]': currentUser.first_name,
    'stripe_user[last_name]': currentUser.last_name,
    'stripe_user[phone_number]': currentUser.phone,
  };
  // Redirect to Stripe to start the Connect onboarding.
  res.redirect( `${process.env.STRIPE_CONNECT_AUTHORIZE_URL}?${querystring.stringify(parameters)}` );
});

export const stripeConnectAuthorize = handleAsyncError( async ( req, res ) => {
  const { code, state } = req.query;
  const { currentUser, currentSession } = await getCurrentSessionAndUser( req.cookies[SESSION_COOKIE_NAME] );

  // Ensure logged in
  if ( !currentUser ) {
    res.redirect('/signup');
    return;
  }

  // validate csrf state
  if ( currentSession.stripeConnectCSRFState !== state ) {
    console.error('Invalid stripeConnectCSRFState'); // eslint-disable-line no-console
    res.redirect('/subscribe');
    return;
  }

  const response = await superagent
    .post(process.env.STRIPE_CONNECT_TOKEN_URL)
    .send({
      grant_type: 'authorization_code',
      client_id: process.env.STRIPE_CONNECT_CLIENT_ID,
      client_secret: process.env.STRIPE_API_SECRET,
      code: code,
    });

  // extract and save the connect token
  const {
    access_token,
    refresh_token,
    stripe_publishable_key,
    stripe_user_id,
  } = response.body;
  currentUser.stripe_connect_token = {
    access_token,
    refresh_token,
    stripe_publishable_key,
    stripe_user_id,
  };
  currentUser.connected = true;
  await currentUser.save();

  // Redirect to subscribe page
  res.redirect('/subscribe');
});

export const expressDashboardRedirect = handleAsyncError( async ( req, res ) => {
  const currentUser = await getCurrentUser( req );
  const response = await stripe.accounts.createLoginLink( currentUser.stripe_connect_token.stripe_user_id );
  res.redirect(response.url);
});

export const platformSubscribe = handleAsyncError( async ( req, res ) => {
  const { token } = req.body;
  // get current user
  const currentUser = await getCurrentUser( req );
  const subscription = await subscribeToPlatform( currentUser, token );

  res.json({
    data: subscription,
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

  // If no customer, create customer with payment method
  if ( !currentUser.stripe_customer_id ) {
    const customer = await stripe.customers.create({
      email: currentUser.email,
      source: token,
    });
    currentUser.stripe_customer_id = customer.id;
    await currentUser.save();
  }
  // Update the customer's payment method
  else {
    await stripe.customers.update(
      currentUser.stripe_customer_id,
      { source: token },
    );
  }
  res.json({
    data: null,
  });
});

export const create = handleAsyncError( async ( req, res ) => {
  const currentUser = await getCurrentUser( req );
  const {
    price_cents, name, description,
  } = req.body;

  // Create stripe plan and product, authorized as connected user
  const plan = await stripe.plans.create({
    amount: price_cents,
    currency: 'USD',
    interval: 'month',
    product: {
      name,
    },
  }, {
    stripe_account: currentUser.stripe_connect_token.stripe_user_id,
  });

  // Create Membership Record
  const membership = await Membership.create({
    name,
    description,
    price_cents,
    created_by: currentUser._id,
    stripe_plan_id: plan.id,
    stripe_product_id: plan.product,
  });

  res.json({
    data: membership,
  });
});

export const update = handleAsyncError( async ( req, res ) => {
  const currentUser = await getCurrentUser( req );
  const { id } = req.params;
  const {
    name, description,
  } = req.body;

  // validate membership exists
  const membership = await Membership.findById(id);
  if (!membership) {
    res.status(404);
    res.json({
      error: {
        message: 'Membership not found',
      },
    });
    return;
  }

  // Update the stripe record
  await stripe.products.update( membership.stripe_product_id, {
    name,
  }, {
    stripe_account: currentUser.stripe_connect_token.stripe_user_id,
  });

  // Update the record
  membership.set({
    name,
    description,
  });
  await membership.save();

  res.json({
    data: null,
  });
});

export const remove = handleAsyncError( async ( req, res ) => {
  const { id } = req.params;
  const currentUser = await getCurrentUser( req );

  const membership = await Membership.findOne({ _id: id });
  // Delete the stripe plan
  await stripe.plans.del(membership.stripe_plan_id, {
    stripe_account: currentUser.stripe_connect_token.stripe_user_id,
  });
  // Delete the stripe product
  await stripe.products.del(membership.stripe_product_id, {
    stripe_account: currentUser.stripe_connect_token.stripe_user_id,
  });

  // Delete the record
  await membership.remove();

  res.json({
    data: membership,
  });
});

export const myMemberships = handleAsyncError( async ( req, res ) => {
  const currentUser = await getCurrentUser( req );

  const memberships = await Membership
    .find({ created_by: currentUser._id })
    .lean();

  res.json({
    data: { items: memberships },
  });
});

export const mySubscriptions = handleAsyncError( async ( req, res ) => {
  res.json({
    name: 'membership: mySubscriptions',
  });
});

export const membershipSubscribe = handleAsyncError( async ( req, res ) => {
  res.json({
    name: 'membership: subscribe',
  });
});

export const membershipUnSubscribe = handleAsyncError( async ( req, res ) => {
  res.json({
    name: 'membership: subscribe',
  });
});
