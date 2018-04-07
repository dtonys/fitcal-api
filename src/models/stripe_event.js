import mongoose, { Schema } from 'mongoose';

const options = {
  timestamps: true,
};
const StripeEventSchema = new Schema({
  _id: String,
}, options);

const StripeEvent = mongoose.model('stripe_event', StripeEventSchema);
export default StripeEvent;
