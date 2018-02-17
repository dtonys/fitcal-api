import { handleAsyncError } from 'helpers/express';


export const create = handleAsyncError( async ( req, res ) => {
  res.json({
    name: 'event: create',
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

export const myEvents = handleAsyncError( async ( req, res ) => {
  res.json({
    name: 'event: myEvents',
  });
});

export const joinEvent = handleAsyncError( async ( req, res ) => {
  res.json({
    name: 'event: joinEvent',
  });
});
