import mongoose, { Schema } from 'mongoose';


export const NOT_RECURRING = 'NOT_RECURRING';
export const RECURRING_DAILY = 'RECURRING_DAILY';
export const RECURRING_WEEKLY = 'RECURRING_WEEKLY';
const MAX_ATTENDANCE = 1000;

const options = {
  timestamps: true,
};
const EventSchema = new Schema({
  name: {
    type: String,
    default: null,
  },
  location: {
    type: String,
    default: null,
  },
  start_date: {
    type: Date,
    default: null,
  },
  end_date: {
    type: Date,
    default: null,
  },
  recurring_type: {
    type: String,
    default: null,
  },
  created_by: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    default: null,
  },
  attending_clients: {
    type: [ {
      type: Schema.Types.ObjectId,
      ref: 'user',
    } ],
    default: [],
  },
  max_clients: {
    type: Number,
    default: MAX_ATTENDANCE,
  },
  price_cents: {
    type: Number,
    default: 0,
  },
  // requires_membership: {
  //   type: Schema.Types.ObjectId,
  //   ref: 'membership',
  // },
}, options);

const Event = mongoose.model('event', EventSchema);
export default Event;
