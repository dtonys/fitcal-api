import mongoose, { Schema } from 'mongoose';

const StripeConnectToken = new Schema({
  access_token: String,
  refresh_token: String,
  stripe_publishable_key: String,
  stripe_user_id: String,
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
  subscribed: Boolean,
  reset_password_token: String,
  is_email_verified: Boolean,
  // stripe
  stripe_customer_id: String,
  stripe_connect_token: StripeConnectToken,
  connected: Boolean,
}, options);

const User = mongoose.model('user', UserSchema);
export default User;
