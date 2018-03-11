import mongoose, { Schema } from 'mongoose';


const InvoicePaymentSchema = new Schema({
  _id: { type: String, required: true },
  amount: { type: String, required: true },
  fee_amount: { type: String, required: true },
  user: { type: Schema.Types.ObjectId, ref: 'user', default: null },
  subscription: { type: Schema.Types.ObjectId, ref: 'stripe_subscription', default: null },
});

const InvoicePayment = mongoose.model('invoice_payment', InvoicePaymentSchema);
export default InvoicePayment;
