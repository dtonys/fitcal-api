import mongoose, { Schema } from 'mongoose';


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
