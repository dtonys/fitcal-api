import mongoose, { Schema } from 'mongoose';


export const NOT_RECURRING = 'NOT_RECURRING';
export const RECURRING_DAILY = 'RECURRING_DAILY';
export const RECURRING_WEEKLY = 'RECURRING_WEEKLY';
const MAX_ATTENDANCE = 1000;

const options = {
  timestamps: true,
};
const EventSchema = new Schema({
  name: String,
  location: String,
  start_date: Date,
  end_date: Date,
  recurring_type: String,
  created_by: { type: Schema.Types.ObjectId, ref: 'user' },
  attending_clients: { type: [ { type: Schema.Types.ObjectId, ref: 'user' } ] },
  max_clients: { type: Number, default: MAX_ATTENDANCE },
  price_cents: Number,
}, options);

export function canJoinEvent( event, user ) {
  const currentUserId = user._id.toString();
  const full = ( event.attending_clients.length >= event.max_clients );
  const owned = ( event.created_by.toString() === currentUserId );
  const attendingClientIds = event.attending_clients.map((clientId) => clientId.toString() );
  const joined = ( attendingClientIds.includes(currentUserId) );
  const can_join = ( !full && !owned && !joined );
  return can_join;
}

const Event = mongoose.model('event', EventSchema);
export default Event;
