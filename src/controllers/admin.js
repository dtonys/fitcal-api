import { handleAsyncError } from 'helpers/express';


export const logonas = handleAsyncError( async ( req, res ) => { // eslint-disable-line
  res.json({
    name: 'admin: logonas',
  });
});
