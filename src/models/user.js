import mongoose, { Schema } from 'mongoose';

const options = {
  timestamps: true,
};
const UserSchema = new Schema({
  first_name: { type: String, default: null },
  last_name: { type: String, default: null },
  username: {
    type: String, unique: true, required: true, dropDups: true, default: null,
  },
  email: {
    type: String, unique: true, required: true, dropDups: true, default: null,
  },
  phone: { type: String, default: null },
  password_hash: { type: String, default: null },
  roles: { type: [ String ], default: [] },
  subscribed: { type: Boolean, default: false },
  reset_password_token: { type: String, default: null },
  is_email_verified: { type: Boolean, default: false },
  // stripe
  stripe_customer_id: { type: String, default: null },
  stripe_connect_user_id: { type: String, default: null },

}, options);

const User = mongoose.model('user', UserSchema);
export default User;
