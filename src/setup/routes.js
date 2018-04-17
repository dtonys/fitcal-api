import { Router } from 'express';
import * as userController from 'controllers/user';
import * as authController from 'controllers/auth';
import * as membershipController from 'controllers/membership';
import * as eventController from 'controllers/events';
import * as errorsController from 'controllers/errorExamples';
import {
  verifyStripeSignature,
  STRIPE_WEBHOOK_ENDPOINT,
  STRIPE_CONNECT_WEBHOOK_ENDPOINT,
} from 'helpers/stripeWebhook';
import { stripeWebhook } from 'controllers/webhook';

import {
  requireRoles,
  loggedInOnly,
  connectedOnly,
} from 'models/session';


const adminOnly = requireRoles([ 'admin' ]);

const router = new Router();

// Health check
router.get('/', (req, res) => {
  res.send('ok');
});

// All `/admin` prefixed routes require admin
router.use('/api/admin', adminOnly);

// Admin


// Admin CRUD users
// router.post('/api/admin/users', userController.create );
// router.patch('/api/admin/users/:id', userController.update );
// router.get('/api/admin/users/:id', userController.get );
// router.get('/api/admin/users', userController.list );
// router.delete('/api/admin/users/:id', userController.remove );

// User profile
router.post('/api/user/profile', userController.updateProfile );
router.post('/api/user/avatar', userController.updateAvatar );

// Auth APIs
router.post('/api/signup', authController.signup );
router.post('/api/login', authController.login );
router.get('/api/logout', authController.logout );
router.get('/api/session', authController.sessionInfo );
router.get('/api/verify-email', authController.verifyEmail );
router.post('/api/lost-password', authController.lostPassword );
router.post('/api/reset-password', authController.resetPassword );
router.get('/api/email/:slug/available', authController.emailAvailable );
router.get('/api/username/:slug/available', authController.usernameAvailable );
router.post('/api/logonas', authController.logonas );

// Error handling examples, trigger ~4 types of errors
router.get('/api/handled-sync-error', errorsController.handledSyncError);
router.get('/api/handled-async-error', errorsController.handledAsyncError);
router.get('/api/unhandled-exception', errorsController.unhandledException);
router.get('/api/unhandled-rejection', errorsController.unhandledRejection);

// Stripe connect endpoints
router.get('/api/stripe/connect', membershipController.stripeConnect);
router.get('/api/stripe/token', membershipController.stripeConnectAuthorize);
router.post('/api/stripe/disconnect', connectedOnly, membershipController.stripeDisconnect);
router.get('/api/stripe/express-dashboard', membershipController.expressDashboardRedirect);


function setWebhookSecretMiddleware( secret ) {
  return (req, res, next) => {
    req.stripeWebhookSecret = secret;
    next();
  };
}
// Stripe webhook endpoint
router.post(
  STRIPE_WEBHOOK_ENDPOINT,
  setWebhookSecretMiddleware(process.env.STRIPE_WEBHOOK_SECRET),
  verifyStripeSignature,
  stripeWebhook
);
// Connect applications have separate webhook endpoint
router.post(
  STRIPE_CONNECT_WEBHOOK_ENDPOINT,
  setWebhookSecretMiddleware(process.env.STRIPE_CONNECT_WEBHOOK_SECRET),
  verifyStripeSignature,
  stripeWebhook
);

// Subscriptions, payments
router.get('/api/payment/method', membershipController.getPaymentMethod);
router.post('/api/payment/method/update', membershipController.updatePaymentMethod);

// Membership APIs
router.post('/api/memberships', connectedOnly, membershipController.create);
router.patch('/api/memberships/:id', connectedOnly, membershipController.update );
router.delete('/api/memberships/:id', connectedOnly, membershipController.remove );
router.get('/api/memberships', membershipController.myMemberships );
// TODO
router.get('/api/:username/memberships', membershipController.getUserMemberships );

router.post('/api/memberships/:id/subscribe', loggedInOnly, membershipController.membershipSubscribe );
router.post('/api/memberships/:id/unsubscribe', loggedInOnly, membershipController.membershipUnSubscribe );
router.get('/api/subscriptions', loggedInOnly, membershipController.mySubscriptions );

// CRUD events ( any user )
router.post('/api/events', loggedInOnly, eventController.create);
router.patch('/api/events/:id', loggedInOnly, eventController.update );
router.delete('/api/events/:id', loggedInOnly, eventController.remove );
router.get('/api/events/:id', eventController.get );
router.get('/api/created/events', loggedInOnly, eventController.myEventList );
router.get('/api/joined/events', loggedInOnly, eventController.myJoinedEventList );
router.get('/api/:username/events', eventController.userEventList );
router.post('/api/events/:id/join', loggedInOnly, eventController.joinEvent );

export default router;
