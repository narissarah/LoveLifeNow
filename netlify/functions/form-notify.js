const nodemailer = require('nodemailer');
const { getConfig, formatHtml, formatText } = require('./utils/email-template');

const VALID_FORM_NAMES = [
  'contact-us', 'volunteer', 'donate', 'newsletter', 'book-a-speaker', 'get-safe-fund'
];

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Origin validation — allow the Netlify site and localhost for dev
  const origin = event.headers.origin || event.headers.referer || '';
  const siteUrl = process.env.URL || ''; // Netlify sets this automatically
  const isAllowedOrigin = siteUrl && origin.startsWith(siteUrl) ||
    origin.startsWith('http://localhost') ||
    origin.startsWith('https://localhost');

  if (!isAllowedOrigin) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Forbidden' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { formName } = body;

    if (!formName || !VALID_FORM_NAMES.includes(formName)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid formName' })
      };
    }

    const config = getConfig(formName);

    const notificationEmail = process.env.NOTIFICATION_EMAIL || process.env.FROM_EMAIL;
    if (!notificationEmail) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'NOTIFICATION_EMAIL not configured' })
      };
    }

    const name = `${body.firstName || ''} ${body.lastName || ''}`.trim() || 'Someone';
    const emailData = {
      name,
      email: body.email || null,
      phone: body.phone || null,
      address: body.address || null,
      date: null,
      customFields: body.customFields || [],
      message: body.message || null,
      constituentId: body.constituentId || null,
      config
    };

    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"Love Life Now" <${process.env.FROM_EMAIL}>`,
      to: notificationEmail,
      replyTo: body.email ? `"${name}" <${body.email}>` : undefined,
      subject: `${config.icon} ${config.title} - ${name}`,
      text: formatText(emailData),
      html: formatHtml(emailData)
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Notification sent' })
    };

  } catch (error) {
    console.error('Form notify error:', error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to send notification' })
    };
  }
};
