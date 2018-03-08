import mongoose, { Schema } from 'mongoose';
const stripe = require('stripe')(process.env.STRIPE_API_SECRET);


const PLATFORM_SUBSCRIBE_PLAN = 'tsc_standard';
const APPLICATION_FEE_PERCENT = 2;
const options = {
  timestamps: true,
};
const SubscriptionSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'user', default: null },
  plan: { type: String, default: null },
  stripe_subscription_id: { type: String, default: null },
  active: { type: Boolean, default: false },
}, options);

const Subscription = mongoose.model('stripe_subscription', SubscriptionSchema);
export default Subscription;


export async function subscribeToPlatform( user ) {
  let customer = null;

  // Create customer if not already created
  if ( !user.stripe_customer_id ) {
    customer = await stripe.customers.create({ email: user.email });
    user.stripe_customer_id = customer.id;
    await user.save();
  }

  // create stripe subscription,
  const stripeSubscription = await stripe.subscriptions.create({
    customer: user.stripe_customer_id,
    items: [ { plan: PLATFORM_SUBSCRIBE_PLAN } ],
    application_fee_percent: APPLICATION_FEE_PERCENT,
  });

  // create subscription record
  const sub = await Subscription.create({
    user: user._id,
    plan: 'tsc_standard',
    stripe_subscription_id: stripeSubscription.id,
    status: stripeSubscription.status === 'active',
  });
  return sub;
}

// delete user's subscription
SubscriptionSchema.methods.cancelPlatformSubscription = async function () { // eslint-disable-line func-names
  const stripeSubscription = await stripe.subscriptions.del( this.stripe_subscription_id );
  this.active = stripeSubscription.status === 'active';
  await this.save();
};

