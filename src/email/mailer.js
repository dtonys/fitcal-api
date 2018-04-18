import fs from 'fs';
import path from 'path';

import lodashTemplate from 'lodash/template';
import nodemailer from 'nodemailer';
import { mjml2html } from 'mjml';
import { createSession } from 'models/session';
import User from 'models/user';


let gmailTransport = null;
const emailTemplates = {};
const emailPartials = {};

export function initialize() {
  // create transport
  gmailTransport = nodemailer.createTransport(`smtps://${process.env.MAILER_EMAIL}:${process.env.MAILER_PASSWORD}@smtp.gmail.com`);

  // Load email templates
  const templateFiles = fs.readdirSync( path.resolve(__dirname, './templates') );
  templateFiles.forEach((templateFile) => {
    const templateName = templateFile.replace('.mjml', '');
    let mjmlString = null;
    // NOTE: try catch for when trying to read directories
    try {
      mjmlString = fs.readFileSync( path.resolve(__dirname, './templates/', templateFile), 'utf8' );
    }
    catch ( err ) {
      return;
    }
    emailTemplates[templateName] = ( dataObject ) => {
      const mjmlCompiled = lodashTemplate(mjmlString)(dataObject);
      const htmlOutput = mjml2html(mjmlCompiled);
      if ( htmlOutput.errors.length ) {
        console.log('mjml2html errors: '); // eslint-disable-line no-console
        console.log(htmlOutput.errors); // eslint-disable-line no-console
      }
      return htmlOutput.html;
    };
  });
  // Load email template partials
  const partialFiles = fs.readdirSync( path.resolve(__dirname, './templates/partials') );
  partialFiles.forEach((partialFile) => {
    const templateName = partialFile.replace('.mjml', '');
    let mjmlString = null;
    // NOTE: try catch for when trying to read directories
    try {
      mjmlString = fs.readFileSync( path.resolve(__dirname, './templates/partials', partialFile), 'utf8' );
    }
    catch ( err ) {
      return;
    }
    emailPartials[templateName] = ( dataObject ) => {
      return lodashTemplate(mjmlString)(dataObject);
    };
  });
  // Hack to expose emailPartials to allow ejs partials to invoke other partials
  global.emailPartials = emailPartials;
}

export function renderEmail( req, res ) {
  const { mailName } = req.params;
  const mjmlString = fs.readFileSync( path.resolve(__dirname, './templates/', mailName + '.mjml'), 'utf8' );
  const mockData =  {
    data: {
      email: 'test@test.com',
      first_name: 'test_first',
      eventType: 'invoice.payment_succeeded',
      eventJSONString: '{"created":1326853478,"livemode":false,"id":"evt_00000000000000","type":"invoice.payment_succeeded","object":"event","request":null,"pending_webhooks":1,"api_version":"2018-02-28","account":"acct_00000000000000","data":{"object":{"id":"in_00000000000000","object":"invoice","amount_due":100,"amount_paid":100,"amount_remaining":0,"application_fee":null,"attempt_count":1,"attempted":true,"billing":"charge_automatically","charge":"_00000000000000","closed":true,"currency":"usd","customer":"cus_00000000000000","date":1523337461,"description":null,"discount":null,"due_date":null,"ending_balance":0,"forgiven":false,"lines":{"data":[{"id":"sub_CU3du9DAyceEDu","object":"line_item","amount":100,"currency":"usd","description":"1 × tsc_standard (at $1.00 / week)","discountable":true,"livemode":false,"metadata":{},"period":{"end":1524547049,"start":1523942249},"plan":{"id":"tsc_standard","object":"plan","amount":100,"billing_scheme":"per_unit","created":1520480224,"currency":"usd","interval":"week","interval_count":1,"livemode":false,"metadata":{},"nickname":"tsc_standard","product":"prod_CS9r6IQNfpUE2G","tiers":null,"tiers_mode":null,"transform_usage":null,"trial_period_days":null,"usage_type":"licensed"},"proration":false,"quantity":1,"subscription":null,"subscription_item":"si_CU3dDkWXMzWFFF","type":"subscription"}],"has_more":false,"object":"list","url":"/v1/invoices/in_1CFErRG0JQCVLaZCTjh1SdUp/lines"},"livemode":false,"metadata":{},"next_payment_attempt":null,"number":"AB18999-0005","paid":true,"period_end":1523337449,"period_start":1522732649,"receipt_number":"2094-8504","starting_balance":0,"statement_descriptor":null,"subscription":"sub_00000000000000","subtotal":100,"tax":null,"tax_percent":null,"total":100,"webhooks_delivered_at":1523337467}}}', // eslint-disable-line
    },
  };
  const mjmlCompiled = lodashTemplate(mjmlString)(mockData);
  const mjmlOutput = mjml2html(mjmlCompiled);

  res.send(mjmlOutput.html);
}

function sendMail({
  from = '"Fitcal" <fitcal@gmail.com>',
  toEmailArray,
  subject,
  html,
}) {
  return new Promise((resolve, reject) => {
    const mailOptions = {
      from, // sender address
      to: toEmailArray.join(', '), // list of receivers
      subject,
      html,
    };
    gmailTransport.sendMail( mailOptions, ( err, info ) => {
      if ( err ) {
        console.log(err); // eslint-disable-line no-console
        reject(err);
        return;
      }
      console.log('Message sent: ' + info.response ); // eslint-disable-line no-console
      resolve();
    });
  });
}

// NOTE: name of the function should match name of the template
export async function signupWelcomEmail( email ) {
  // create link with `/api/verify-email?sessionToken=<hash>`;
  const user = await User.findOne({ email: email });
  if ( !user ) {
    console.log(`verifySignupEmail: ${email} not found`); // eslint-disable-line no-console
    return;
  }
  // Create session
  const session = await createSession( user._id.toString() );
  const sessionId = session._id.toString();
  // Send token out to auth the verify-email api
  const verifyLink = `${process.env.API_SERVER_BASE}/api/verify-email?sessionToken=${sessionId}`;
  const html = emailTemplates['signupWelcome']({
    data: {
      first_name: user.first_name,
      verifyLink: verifyLink,
    },
  });

  await sendMail({
    toEmailArray: [ email ],
    subject: 'Email Verification',
    html: html,
  });
}

export async function resetPasswordEmail( email ) {
  const user = await User.findOne({ email: email });
  if ( !user ) {
    console.log(`verifySignupEmail: ${email} not found`); // eslint-disable-line no-console
    return;
  }

  // Create session
  const session = await createSession( user._id.toString() );
  const sessionId = session._id.toString();
  // Save one session per user
  user.set({ reset_password_token: sessionId });
  await user.save();
  // Send the token out, one time use.
  const resetLink = `${process.env.WEB_SERVER_BASE}/reset-password?sessionToken=${sessionId}`;
  const html = emailTemplates['resetPassword']({
    data: {
      first_name: user.first_name,
      resetLink: resetLink,
    },
  });
  await sendMail({
    toEmailArray: [ email ],
    subject: 'Reset Password',
    html: html,
  });
}

export async function webhookEventJSON( email, event ) {
  const user = await User.findOne({ email: email });

  const eventType = event.type;
  const eventJSONString = JSON.stringify(event, null, 2);

  const html = emailTemplates['webhookEventJSON']({
    data: {
      first_name: user.first_name,
      eventType,
      eventJSONString,
    },
  });

  await sendMail({
    toEmailArray: [ email ],
    subject: 'Reset Password',
    html: html,
  });
}

