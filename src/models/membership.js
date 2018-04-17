import mongoose, { Schema } from 'mongoose';
// const stripe = require('stripe')(process.env.STRIPE_API_SECRET);


const options = {
  timestamps: true,
};
const MembershipSchema = new Schema({
  name: String,
  description: String,
  price_cents: Number,
  created_by: { type: Schema.Types.ObjectId, ref: 'user' },
  // plan describes the price and billing interval for the membership
  stripe_plan_id: String,
  // product describes the name, type, and optional metadata
  stripe_product_id: String,
}, options);

const Membership = mongoose.model('membership', MembershipSchema);
export default Membership;

export function canJoinMembership( membership, user ) {
  const owned = ( membership.created_by.equals(user._id) );
  const joined = user.subscribed_memberships.some((joinedMembership) => {
    return joinedMembership.equals(membership._id);
  });
  const can_join = ( !owned && !joined );
  return can_join;
}

export async function cancelMembership( user, token ) {
  // TODO
}

export async function subscribeToMembership() {
  // create customer if not created
  // subscribe them to the specified plan
  // create membership record
}
