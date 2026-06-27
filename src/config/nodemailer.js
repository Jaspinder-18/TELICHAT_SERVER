import nodemailer from 'nodemailer';

let transporter;

const getTransporter = async () => {
  if (transporter) return transporter;

  if (
    process.env.SMTP_HOST === 'smtp.ethereal.email' &&
    process.env.SMTP_USER === 'mockuser@ethereal.email'
  ) {
    // Dynamically create a test account on ethereal.email if default config is used
    try {
      const testAccount = await nodemailer.createTestAccount();
      console.log(`Generated Ethereal SMTP test credentials: User=${testAccount.user}`);
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      // Patch env so we can see where to check messages
      process.env.SMTP_USER = testAccount.user;
      process.env.SMTP_PASS = testAccount.pass;
    } catch (error) {
      console.error('Failed to create Ethereal test account, falling back to dummy logging transporter:', error);
      transporter = {
        sendMail: async (mailOptions) => {
          console.log('\n--- MAIL DUMMY TRANSPORTER ---');
          console.log(`To: ${mailOptions.to}`);
          console.log(`Subject: ${mailOptions.subject}`);
          console.log(`Content:\n${mailOptions.text || mailOptions.html}`);
          console.log('-------------------------------\n');
          return { messageId: 'dummy-id' };
        }
      };
    }
  } else {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  return transporter;
};

export const sendEmail = async ({ to, subject, html, text }) => {
  const mailTransporter = await getTransporter();
  const mailOptions = {
    from: process.env.SMTP_FROM || '"Enterprise Office Chat" <noreply@officechat.com>',
    to,
    subject,
    text,
    html,
  };

  const info = await mailTransporter.sendMail(mailOptions);
  
  // If it's an ethereal account, print preview link
  if (process.env.SMTP_HOST === 'smtp.ethereal.email') {
    console.log(`Email sent successfully. Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
  }
  return info;
};
