import mongoose, { Schema } from 'mongoose';

const StripeConnectToken = new Schema({
  access_token: String,
  refresh_token: String,
  stripe_publishable_key: String,
  stripe_user_id: String,
});

const CustomerReference = new Schema({
  instructor_user_id: { type: Schema.Types.ObjectId, ref: 'user' },
  stripe_customer_id: String,
});

const options = {
  timestamps: true,
};
const UserSchema = new Schema({
  first_name: String,
  last_name: String,
  username: {
    type: String, unique: true, dropDups: true,
  },
  email: {
    type: String, unique: true, dropDups: true,
  },
  phone: String,
  password_hash: String,
  roles: [ String ],
  reset_password_token: String,
  is_email_verified: Boolean,
  // stripe
  stripe_customer_id: String,
  stripe_connect_token: StripeConnectToken,
  connected: Boolean,
  stripe_customer_references: [ CustomerReference ],
  subscribed_memberships: { type: [ { type: Schema.Types.ObjectId, ref: 'membership' } ] },
}, options);

const User = mongoose.model('user', UserSchema);
export default User;
