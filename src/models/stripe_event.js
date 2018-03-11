import mongoose, { Schema } from 'mongoose';


const StripeEventSchema = new Schema({
  _id: { type: String, required: true },
});

const StripeEvent = mongoose.model('stripe_event', StripeEventSchema);
export default StripeEvent;
