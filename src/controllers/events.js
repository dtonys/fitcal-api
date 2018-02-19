import Event from 'models/event';
import { handleAsyncError } from 'helpers/express';
import {
  getCurrentUser,
} from 'helpers/session';

export const create = handleAsyncError( async ( req, res ) => {
  // get input
  const {
    name,
    location,
    start,
    end,
    repeats,
    capacity,
    price_cents, // eslint-disable-line camelcase
  } = req.body;

  // get current user
  const currentUser = await getCurrentUser( req );
  if ( !currentUser ) {
    res.status(401);
    res.json({
      error: {
        message: 'Unauthorized access',
      },
    });
    return;
  }

  // create resource
  const event = await Event.create({
    name,
    location,
    start_date: new Date(start),
    end_date: new Date(end),
    recurring_type: repeats,
    created_by: currentUser,
    max_clients: parseInt(capacity, 10),
    price_cents: parseInt(price_cents, 10),
  });

  // return resource
  res.json({
    data: event,
  });
});

export const update = handleAsyncError( async ( req, res ) => {
  res.json({
    name: 'event: update',
  });
});

export const remove = handleAsyncError( async ( req, res ) => {
  res.json({
    name: 'event: remove',
  });
});

export const myEventList = handleAsyncError( async ( req, res ) => {
  const currentUser = await getCurrentUser( req );
  const myEvents = await Event
    .find({ created_by: currentUser })
    .sort({ start_date: 1 });

  res.json({
    data: {
      items: myEvents,
    },
  });
});

export const joinEvent = handleAsyncError( async ( req, res ) => {
  res.json({
    name: 'event: joinEvent',
  });
});
