import { handleAsyncError } from 'helpers/express';


function asyncTimeoutError() {
  return new Promise((resolve /* , reject */) => {
    setTimeout(() => {
      const a = b; // eslint-disable-line
      resolve();
    }, 1000);
  });
}

function rejectPromise() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error('This is rejected'));
    }, 1000);
  });
}

export const handledSyncError = ( req, res ) => {
  const a = b; // eslint-disable-line
  res.json({});
};

export const handledAsyncError = handleAsyncError( async ( req, res ) => {
  const a = b; // eslint-disable-line
  res.json({});
});

export const unhandledException = ( req, res ) => {
  asyncTimeoutError()
    .then(() => {
      res.json({});
    });
};

export const unhandledRejection = async ( req, res ) => {
  await rejectPromise();
  res.json({});
};
