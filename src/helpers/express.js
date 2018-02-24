import parseDomain from 'parse-domain';


// Report async errors to express middleware
export const handleAsyncError = ( asyncFn ) => async ( req, res, next ) => { // eslint-disable-line import/prefer-default-export
  try {
    await asyncFn(req, res, next);
  }
  catch ( error ) {
    next( error );
  }
};

// Get the value we need to set to the domain for cross subdomain cookies
// www.dtonyschwartz.com => '.dtonyschwartz.com'
export function getCrossDomainCookieValue( req ) {
  const parsed = parseDomain(req.get('host'));
  if ( parsed && parsed.domain && parsed.tld ) {
    return `.${parsed.domain}.${parsed.tld}`;
  }
  return undefined;
}
