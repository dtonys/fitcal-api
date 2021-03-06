import mongoose, { Schema } from 'mongoose';

// Legacy
// delete user's subscription
// SubscriptionSchema.methods.cancelPlatformSubscription = async function () { // eslint-disable-line func-names
//   const user = await User.findById( this.user );
//   const stripeSubscription = await stripe.subscriptions.del( this.stripe_subscription_id );
//   // mark user as unsubscribed
//   user.subscribed = isSubscribed(stripeSubscription.status);
//   await user.save();
//   // sync subscription status
//   this.status = stripeSubscription.status;
//   await this.save();
// };

// export async function subscribeToPlatform( user, token ) {
//   // Create customer with payment method
//   if ( !user.stripe_customer_id ) {
//     const customer = await stripe.customers.create({
//       email: user.email,
//       source: token,
//     });
//     user.stripe_customer_id = customer.id;
//     await user.save();
//   }

//   // create stripe subscription,
//   const stripeSubscription = await stripe.subscriptions.create({
//     customer: user.stripe_customer_id,
//     items: [ { plan: process.env.PLATFORM_SUBSCRIBE_PLAN } ],
//   });

//   // create subscription record
//   const sub = await Subscription.create({
//     user: user._id,
//     plan: 'tsc_standard',
//     stripe_subscription_id: stripeSubscription.id,
//     status: stripeSubscription.status,
//   });
//   // update user's subscription status
//   user.subscribed = isSubscribed(stripeSubscription.status);
//   await user.save();

//   return sub;
// }

// in free trial
const SUBSCRIPTION_STATUS_TRIALING = 'trialing';
// activated, subscription is in good standing
const SUBSCRIPTION_STATUS_ACTIVE = 'active';
// past_due, stripe will continue to create invoices and attempt to bill customers
// Pay the most recent invoice to set status back to active
const SUBSCRIPTION_STATUS_PAST_DUE = 'past_due';
// canceled, subscription is deleted, no new invoices are created.
// Use must re-subscribe to get back onto platform
// const SUBSCRIPTION_STATUS_CANCELED = 'canceled';
// unpaid, new invoiced are created but immediately closed, and not billed.
// Pay the most recent invoice to set status back to active
// const SUBSCRIPTION_STATUS_UNPAID = 'unpaid';
export function isSubscribed( subscriptionStatus ) {
  return (
    subscriptionStatus === SUBSCRIPTION_STATUS_ACTIVE ||
    subscriptionStatus === SUBSCRIPTION_STATUS_TRIALING ||
    subscriptionStatus === SUBSCRIPTION_STATUS_PAST_DUE
  );
}

const options = {
  timestamps: true,
};
const MembershipSubscriptionSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'user' },
  membership: { type: Schema.Types.ObjectId, ref: 'membership' },
  stripe_subscription_id: String,
  status: String,
}, options);

const MembershipSubscription = mongoose.model('membership_subscription', MembershipSubscriptionSchema);
export default MembershipSubscription;
