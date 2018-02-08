import User from 'models/user';
import bcrypt from 'bcrypt';
import {
  createSessionWithCookie,
  getCurrentSessionAndUser,
  deleteSession,
} from 'helpers/session';
import {
  SESSION_COOKIE_NAME,
} from 'models/session';
import { handleAsyncError } from 'helpers/express';
import * as mailer from 'email/mailer';

export const signup = handleAsyncError( async ( req, res ) => {
  const {
    email,
    password,
  } = req.body;

  // check if user already exists with email
  const existingUser = await User.findOne({ email: email });
  if ( existingUser ) {
    res.status(422);
    res.json({
      error: {
        message: 'User email already in use',
      },
    });
    return;
  }

  // generate password hash
  const passwordHash = await new Promise((resolve, reject) => {
    bcrypt.hash(password, 10, ( err, hash ) => {
      if ( err ) {
        reject(err);
      }
      resolve(hash);
    });
  });
  // create user
  const user = await User.create({
    email: email,
    password_hash: passwordHash,
  });

  // log user in
  await createSessionWithCookie(user._id.toString(), res);
  // Send verification email
  mailer.signupWelcomEmail( email );

  // return user
  res.json({
    data: user,
  });
});

export const login = handleAsyncError( async ( req, res ) => {
  const {
    email,
    password,
  } = req.body;

  // find user by email
  const user = await User.findOne({ email: email });
  if ( !user ) {
    // user not found
    res.status(404);
    res.json({
      error: {
        message: 'Email not found',
      },
    });
    return;
  }

  const validPassword = await new Promise(( resolve, reject ) => {
    bcrypt.compare(password, user.password_hash, ( err, valid ) => {
      if ( err ) {
        reject(err);
      }
      resolve(valid);
    });
  });
  if ( !validPassword ) {
    // wrong password
    res.status(422);
    res.json({
      error: {
        message: 'Wrong password',
      },
    });
    return;
  }
  // log user in
  await createSessionWithCookie( user._id.toString(), res );
  // login success
  res.json({
    data: user,
  });
});

export const logout = handleAsyncError( async ( req, res ) => {
  const sessionId = req.cookies[SESSION_COOKIE_NAME];
  if ( sessionId ) {
    await deleteSession(sessionId);
    res.clearCookie(SESSION_COOKIE_NAME);
    res.json({
      data: null,
    });
    return;
  }
  res.json({
    data: null,
  });
});

export const sessionInfo = handleAsyncError( async ( req, res ) => {
  const sessionId = req.cookies[SESSION_COOKIE_NAME];
  if ( !sessionId ) {
    res.json({
      data: null,
    });
    return;
  }
  const { currentUser, currentSession } = await getCurrentSessionAndUser( sessionId );
  if ( !currentUser || !currentSession ) {
    res.json({
      data: null,
    });
    return;
  }
  const _currentUser = currentUser.toObject();
  delete _currentUser.password_hash;
  res.json({
    data: {
      currentUser: _currentUser,
      currentSession,
    },
  });
});

export const verifyEmail = handleAsyncError( async ( req, res ) => {
  const { sessionToken } = req.query;
  const decodedSessionToken = sessionToken.replace(/ /g, '+');
  const {
    currentUser,
    currentSession,
  } = await getCurrentSessionAndUser( decodedSessionToken );
  if ( !currentUser || !currentSession ) {
    console.log('User not found or invalid session');
    res.redirect(process.env.WEB_SERVER_BASE + '/');
    return;
  }
  // set user as verified
  currentUser.set({ is_email_verified: true });
  await currentUser.save();
  // destroy the session
  await currentSession.remove();

  // log user in
  await createSessionWithCookie( currentUser._id.toString(), res );
  // redirect to home page
  res.redirect(process.env.WEB_SERVER_BASE + '/');
});

export const lostPassword = handleAsyncError( async ( req, res ) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if ( !user ) {
    // user not found
    res.status(404);
    res.json({
      error: {
        message: 'Email not found',
      },
    });
    return;
  }
  mailer.resetPasswordEmail( user.email );
  res.json({
    data: null,
  });
});

export const resetPassword = handleAsyncError( async ( req, res ) => {
  const { sessionToken, password, passwordConfirm } = req.body;
  const { currentUser, currentSession } = await getCurrentSessionAndUser( sessionToken );
  if ( !currentSession || !currentUser ) {
    res.status(422);
    res.json({
      error: {
        message: 'Invalid or expired session.',
      },
    });
    return;
  }
  if ( currentUser.reset_password_token !== sessionToken ) {
    res.status(422);
    res.json({
      error: {
        message: 'Invalid or expired session.',
      },
    });
    return;
  }

  let errorMessage = null;
  if ( password !== passwordConfirm ) {
    errorMessage = 'Password and confirm must match.';
  }
  if ( errorMessage ) {
    res.status(422);
    res.json({
      error: {
        message: errorMessage,
      },
    });
    return;
  }

  // set the new password
  const passwordHash = await new Promise((resolve, reject) => {
    bcrypt.hash(password, 10, ( err, hash ) => {
      if ( err ) {
        reject(err);
      }
      resolve(hash);
    });
  });

  currentUser.set({
    password_hash: passwordHash,
    reset_password_token: null,
  });
  await currentUser.save();
  // destroy the session
  await currentSession.remove();

  // done
  res.json({
    data: null,
  });
});

