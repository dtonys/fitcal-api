import mongoose, { Schema } from 'mongoose';


const StripeWebhookSchema = new Schema({
  _id: { type: String, required: true },
});

const StripeWebhook = mongoose.model('stripe_webhook', StripeWebhookSchema);
export default StripeWebhook;
