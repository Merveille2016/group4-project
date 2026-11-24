const nodemailer = require('nodemailer');
const defaultConfig = require('../config');

// Without SMTP_HOST the link is printed to the console instead
function createMailer(config = defaultConfig) {
  const { smtp } = config;
  const transport = smtp.host
    ? nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    })
    : null;

  return {
    async sendPasswordReset({ to, name, link, minutes }) {
      if (!transport) {
        if (config.isProduction) {
          console.error('[mailer] SMTP_HOST is not set, so the password reset email was not sent.');
        } else {
          console.log(`[mailer] SMTP not configured. Password reset link for ${to}:\n  ${link}`);
        }
        return;
      }

      const greeting = name ? `Hello ${name},` : 'Hello,';
      await transport.sendMail({
        from: smtp.from,
        to,
        subject: 'Reset your UniGuide Cameroon password',
        text: [
          greeting,
          '',
          'Someone asked to reset the password for this account. If it was you, open this link:',
          link,
          '',
          `The link works once and expires in ${minutes} minutes.`,
          'If you did not ask for this, ignore this email; your password stays the same.',
        ].join('\n'),
      });
    },
  };
}

module.exports = { createMailer };
