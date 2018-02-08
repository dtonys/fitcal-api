import fs from 'fs';
import path from 'path';

import lodashTemplate from 'lodash/template';
import nodemailer from 'nodemailer';
import { mjml2html } from 'mjml';
import { createSession } from 'helpers/session';
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
      email: user.email,
      first_name: user.email,
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
      email: user.email,
      first_name: user.email,
      resetLink: resetLink,
    },
  });
  await sendMail({
    toEmailArray: [ email ],
    subject: 'Reset Password',
    html: html,
  });
}

