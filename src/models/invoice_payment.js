import mongoose, { Schema } from 'mongoose';


const InvoicePaymentSchema = new Schema({
  _id: String,
  amount: String,
  fee_amount: String,
  user: { type: Schema.Types.ObjectId, ref: 'user' },
  subscription: { type: Schema.Types.ObjectId, ref: 'stripe_subscription' },
});

const InvoicePayment = mongoose.model('invoice_payment', InvoicePaymentSchema);
export default InvoicePayment;
