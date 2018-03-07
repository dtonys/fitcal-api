import Event, {
  canJoinEvent,
} from 'models/event';
import User from 'models/user';
import { handleAsyncError } from 'helpers/express';
import {
  getCurrentUser,
} from 'models/session';

function getEventData( body ) {
  return {
    name: body.name,
    location: body.location,
    start_date: new Date(body.start),
    end_date: new Date(body.end),
    recurring_type: body.repeats,
    max_clients: parseInt(body.capacity, 10),
    price_cents: parseInt(body.price_cents, 10),
  };
}

export const create = handleAsyncError( async ( req, res ) => {

  // get current user
  const currentUser = await getCurrentUser( req );

  // create resource
  const event = await Event.create({
    ...getEventData(req.body),
    created_by: currentUser._id,
  });

  // return resource
  res.json({
    data: event,
  });
});

export const update = handleAsyncError( async ( req, res ) => {
  const { id } = req.params;

  // validate event exists
  const event = await Event.findById(id);
  if (!event) {
    res.status(404);
    res.json({
      error: {
        message: 'Event not found',
      },
    });
    return;
  }
  // validate user owns the event
  const currentUser = await getCurrentUser( req );
  const userOwnsEvent = ( currentUser._id.toString() === event.created_by.toString() );
  if ( !userOwnsEvent ) {
    res.status(401);
    res.json({
      error: {
        message: 'Unauthorized access',
      },
    });
    return;
  }

  // set and save
  event.set({
    ...getEventData(req.body),
  });
  await event.save();

  res.json({
    data: null,
  });
});

export const remove = handleAsyncError( async ( req, res ) => {
  const { id } = req.params;
  const deletedEvent = await Event.findOneAndRemove({ _id: id });
  res.json({
    data: deletedEvent,
  });
});

export const get = handleAsyncError( async ( req, res ) => {
  const { id } = req.params;
  const currentUser = await getCurrentUser( req );
  const event = await Event.findById(id);
  const eventJSON = event.toJSON();

  if ( !event ) {
    res.status(404);
    res.json({
      error: { message: 'User not found' },
    });
  }

  eventJSON.can_join = canJoinEvent(event, currentUser);
  res.json({
    data: eventJSON,
  });
});

export const myEventList = handleAsyncError( async ( req, res ) => {
  const currentUser = await getCurrentUser( req );
  const myEvents = await Event
    .find({ created_by: currentUser._id })
    .sort({ start_date: 1 })
    .lean(); // NOTE: use `lean` for read only queries, faster and no need to convert to JSON.

  res.json({
    data: {
      items: myEvents,
    },
  });
});

export const myJoinedEventList = handleAsyncError( async ( req, res ) => {
  const currentUser = await getCurrentUser( req );
  const myEvents = await Event
    .find({ attending_clients: { $in: [ currentUser ] } })
    .sort({ start_date: 1 })
    .lean(); // NOTE: use `lean` for read only queries, faster and no need to convert to JSON.

  res.json({
    data: {
      items: myEvents,
    },
  });
});

export const userEventList = handleAsyncError( async ( req, res ) => {
  const { username } = req.params;
  const currentUser = await getCurrentUser( req );
  const targetUser = await User.find({ username });
  if ( !targetUser ) {
    res.status(404);
    res.json({
      error: { message: 'User not found' },
    });
    return;
  }

  const userEvents = await Event
    .find({ created_by: targetUser })
    .sort({ start_date: 1 })
    .lean(); // NOTE: use `lean` for read only queries, faster and no need to convert to JSON.

  // Compute can_join
  userEvents.forEach((event) => {
    event.can_join = canJoinEvent(event, currentUser);
  });

  res.json({
    data: {
      items: userEvents,
    },
  });

});

export const joinEvent = handleAsyncError( async ( req, res ) => {
  const { id } = req.params;

  const currentUser = await getCurrentUser( req );
  const event = await Event.findById(id);

  // Validate can join
  if ( !canJoinEvent(event, currentUser) ) {
    res.status(422);
    res.json({
      error: { message: 'Cannot join event.' },
    });
    return;
  }

  // Join event
  await event.update({
    $addToSet: { attending_clients: currentUser._id },
  });
  res.json({
    data: null,
  });
});
