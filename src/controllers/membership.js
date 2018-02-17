import { handleAsyncError } from 'helpers/express';


export const create = handleAsyncError( async ( req, res ) => {
  res.json({
    name: 'membership: create',
  });
});

export const update = handleAsyncError( async ( req, res ) => {
  res.json({
    name: 'membership: update',
  });
});

export const remove = handleAsyncError( async ( req, res ) => {
  res.json({
    name: 'membership: remove',
  });
});

export const myMemberships = handleAsyncError( async ( req, res ) => {
  res.json({
    name: 'membership: myMemberships',
  });
});

export const mySubscriptions = handleAsyncError( async ( req, res ) => {
  res.json({
    name: 'membership: mySubscriptions',
  });
});

export const subscribe = handleAsyncError( async ( req, res ) => {
  res.json({
    name: 'membership: subscribe',
  });
});
