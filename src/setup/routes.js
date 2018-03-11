import { Router } from 'express';
import * as userController from 'controllers/user';
import * as authController from 'controllers/auth';
import * as membershipController from 'controllers/membership';
import * as eventController from 'controllers/events';
import { verifyStripeSignature } from 'helpers/stripeWebhook';
import { stripeWebhook } from 'controllers/webhook';

import {
  requireRoles,
  loggedInOnly,
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
router.get('/api/transactions', userController.getTransactions );
router.get('/api/stripe/connect', userController.stripeConnect );

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

// Stripe webhook endpoint
router.post( '/api/stripe/webhook', verifyStripeSignature, stripeWebhook );

// Subscription

// CRUD memberships ( platform subscribed user )
router.post(
  '/api/platform/subscribe',
  loggedInOnly,
  membershipController.platformSubscribe,
);
router.post(
  '/api/platform/unsubscribe',
  loggedInOnly,
  membershipController.platformUnSubscribe,
);

// Payment method ( comes from stripe )
router.get('/api/payment/method', membershipController.getPaymentMethod);
router.post('/api/payment/method/update', membershipController.updatePaymentMethod);

router.post('/api/memberships', membershipController.create);
router.patch('/api/memberships/:id', membershipController.update );
router.delete('/api/memberships/:id', membershipController.remove );
router.get('/api/memberships', membershipController.myMemberships );
router.get('/api/subscriptions', membershipController.mySubscriptions );
router.post('/api/subscribe/:id', membershipController.subscribe );

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
