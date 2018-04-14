import superagent from 'superagent';
import lodashFind from 'lodash/find';
import { handleAsyncError } from 'helpers/express';
import querystring from 'querystring';
import {
  SESSION_COOKIE_NAME,
  getCurrentSessionAndUser,
  getCurrentUser,
} from 'models/session';
import Membership, {
  canJoinMembership,
} from 'models/membership';
import MembershipSubscription from 'models/membership_subscription';
import User from 'models/user';
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

export const stripeDisconnect = handleAsyncError( async ( req, res ) => {
  const currentUser = await getCurrentUser( req );

  // disconnect from stripe
  await superagent
    .post(process.env.STRIPE_CONNECT_DEAUTHORIZE_URL)
    .send({
      client_id: process.env.STRIPE_CONNECT_CLIENT_ID,
      client_secret: process.env.STRIPE_API_SECRET,
      stripe_user_id: currentUser.stripe_connect_token.stripe_user_id,
    });

  // Update the user record
  currentUser.set({
    stripe_connect_token: null,
    connected: false,
  });
  await currentUser.save();

  res.json({
    data: null,
  });
});

export const expressDashboardRedirect = handleAsyncError( async ( req, res ) => {
  const currentUser = await getCurrentUser( req );
  const response = await stripe.accounts.createLoginLink( currentUser.stripe_connect_token.stripe_user_id );
  res.redirect(response.url);
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

  // TODO: Downgrade all connected events to free.
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

export const getUserMemberships = handleAsyncError( async ( req, res ) => {
  const { username } = req.params;
  const currentUser = await getCurrentUser( req );
  const targetUser = await User.find({ username });

  if ( !targetUser ) {
    res.status(404);
    res.json({
      error: { message: 'User not found' },
    });
    return;
  }

  const memberships = await Membership
    .find({ created_by: targetUser })
    .lean(); // NOTE: use `lean` for read only queries, faster and no need to convert to JSON.

  // TODO: Compute can_join, user can join event if he is not creater and is not already joined
  memberships.forEach((membership) => {
    // HACK: If user is logged out, set can_join to true to enable button
    // which will redirect to signup.
    membership.can_join = currentUser ? canJoinMembership(membership, currentUser) : true;
  });

  res.json({
    data: { items: memberships },
  });
});

export const mySubscriptions = handleAsyncError( async ( req, res ) => {
  const currentUser = await getCurrentUser( req );
  const subscriptions = await MembershipSubscription
    .find({ user: currentUser })
    .populate('membership');

  const subscribedMemberships = subscriptions.map((sub) => sub.membership);

  res.json({
    data: subscribedMemberships,
  });
});

export const membershipSubscribe = handleAsyncError( async ( req, res ) => {
  const { id } = req.params;
  const { token } = req.body;

  const currentUser = await getCurrentUser( req );
  const membership = await Membership.findOne({ _id: id });
  if (!membership) {
    res.status(404);
    res.json({
      error: { message: 'Membership not found' },
    });
    return;
  }
  const membershipCreator = await User.findOne({ _id: membership.created_by });
  // validate connected
  if (!membershipCreator.connected) {
    res.status(422);
    res.json({
      error: { message: 'Membership creator is no longer connected to the platform' },
    });
    return;
  }
  // validate user does not own membership
  if ( membershipCreator._id.toString() === currentUser._id.toString() ) {
    res.status(422);
    res.json({
      error: { message: 'You cannot subscribe to memberships you own.' },
    });
    return;
  }

  // validate user is not already subscribed to membership
  // if ( currentUser.subscribed_memberships )

  const membershipCreatorId = membershipCreator._id.toString();
  const membershipCreatorStripeAccountId =  membershipCreator.stripe_connect_token.stripe_user_id;

  // if customer does not exist on platform, create it, using token as payment method
  if ( !currentUser.stripe_customer_id ) {
    const platformCustomer = await stripe.customers.create({
      email: currentUser.email,
      source: token,
    });
    console.log('platformCustomer created');
    console.log(platformCustomer);
    currentUser.stripe_customer_id = platformCustomer.id;
  }

  // check user map to see if user is already a customer of the instructor who owns this membership.
  const instructorCustomerRef = lodashFind( currentUser.stripe_customer_references, ( customerReference ) => {
    return ( customerReference.instructor_user_id.toString() === membershipCreatorId );
  });
  let instructorCustomerId = instructorCustomerRef ? instructorCustomerRef.stripe_customer_id : null;

  // if no customer, create a new customer on instructor account,
  if ( !instructorCustomerId ) {
    // generate a payment token, given the platform customer_id, and the connected account id
    // this is to re-use the existing payment method that is already on the platform
    const paymentToken = await stripe.tokens.create({
      customer: currentUser.stripe_customer_id,
    }, {
      stripe_account: membershipCreatorStripeAccountId,
    });
    console.log('paymentToken generated');
    console.log(paymentToken);

    // create a new customer on the instructor account, using email and generated payment token
    const instructorCustomer = await stripe.customers.create({
      email: currentUser.email,
      source: paymentToken.id,
    }, {
      stripe_account: membershipCreatorStripeAccountId,
    });
    console.log('instructorCustomer created');
    console.log(instructorCustomer);
    instructorCustomerId = instructorCustomer.id;

    // Update user record, add the created customer id to an array within user object
    currentUser.update({
      $addToSet: {
        stripe_customer_references: {
          instructor_user_id: membershipCreator._id,
          stripe_customer_id: instructorCustomerId,
        },
      },
    });

    console.log('customer reference added to user');
    console.log(currentUser);
  }
  // subscribe the instructor's customer to their plan
  const stripeSubscription = await stripe.subscriptions.create({
    customer: instructorCustomerId,
    items: [ { plan: membership.stripe_plan_id } ],
  }, {
    stripe_account: membershipCreatorStripeAccountId,
  });
  console.log('stripe subscription created');
  console.log(stripeSubscription);

  // create a MembershipSubscription record
  // NOTE: Status should be updated via webhooks
  const membershipSubscription = await MembershipSubscription.create({
    user: currentUser._id,
    membership: membership._id,
    stripe_subscription_id: stripeSubscription.id,
    status: stripeSubscription.status,
  });
  console.log('membership subscription record created');
  console.log(membershipSubscription);

  // update user record, add to list of subscribed memberships
  currentUser.update({
    $addToSet: {
      subscribed_memberships: membership._id,
    },
  });
  await currentUser.save();

  // subscribed_memberships
  // TODO: send emails, `clientSubscriptionConfirmation`, `instructorSubscriptionConfirmation`
  // to indicate the subscription was finalized

  // return MembershipSubscription
  res.json({
    data: membershipSubscription,
  });
});

export const membershipUnSubscribe = handleAsyncError( async ( req, res ) => {
  res.json({
    name: 'membership: subscribe',
  });
});
