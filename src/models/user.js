import mongoose, { Schema } from 'mongoose';


export const USER_ROLE_TRAINER = 'trainer';
export const USER_ROLE_CLIENT = 'client';
export const USER_ROLE_ADMIN = 'admin';

const UserSchema = new Schema({
  created_at: {
    type: Date,
    default: Date.now,
  },
  first_name: {
    type: String,
  },
  last_name: {
    type: String,
  },
  username: {
    type: String,
    unique: true,
    required: true,
    dropDups: true,
  },
  email: {
    type: String,
    unique: true,
    required: true,
    dropDups: true,
  },
  phone: {
    type: String,
  },
  password_hash: {
    type: String,
  },
  roles: {
    type: [ String ],
    default: [],
  },
  subscribed: {
    type: Boolean,
    default: false,
  },
  reset_password_token: {
    type: String,
  },
  is_email_verified: {
    type: Boolean,
    default: false,
  },
});

const User = mongoose.model('user', UserSchema);
export default User;
