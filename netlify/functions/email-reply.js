const nodemailer = require('nodemailer');
const { verifyAuth, unauthorizedResponse } = require('./utils/auth');

// Create reusable transporter
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

// Format plain text message as simple HTML with quoted original
function formatEmailHtml(message, originalMessage, originalDate, originalName) {
  const escapedMessage = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  // Format quoted original message if provided
  let quotedSection = '';
  if (originalMessage) {
    const escapedOriginal = originalMessage
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    const dateStr = originalDate ? new Date(originalDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }) : '';

    quotedSection = `
      <div class="quoted">
        <p class="quoted-header">On ${dateStr}, ${originalName || 'Unknown'} wrote:</p>
        <blockquote>${escapedOriginal}</blockquote>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          font-size: 12px;
          color: #666;
        }
        .quoted {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eee;
        }
        .quoted-header {
          color: #666;
          font-size: 12px;
          margin-bottom: 10px;
        }
        blockquote {
          margin: 0;
          padding-left: 15px;
          border-left: 3px solid #ccc;
          color: #555;
        }
      </style>
    </head>
    <body>
      <div>${escapedMessage}</div>
      ${quotedSection}
      <div class="footer">
        <p>Love Life Now<br>
        Helping survivors of domestic violence</p>
      </div>
    </body>
    </html>
  `;
}

// Format plain text with quoted original
function formatPlainText(message, originalMessage, originalDate, originalName) {
  let text = message;

  if (originalMessage) {
    const dateStr = originalDate ? new Date(originalDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }) : '';

    const quotedOriginal = originalMessage.split('\n').map(line => `> ${line}`).join('\n');
    text += `\n\n---\nOn ${dateStr}, ${originalName || 'Unknown'} wrote:\n${quotedOriginal}`;
  }

  return text;
}

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Check authentication
  if (!verifyAuth(event)) {
    return unauthorizedResponse();
  }

  try {
    const { to, subject, message, submissionId, originalMessage, originalDate, originalName } = JSON.parse(event.body || '{}');

    // Validate required fields
    if (!to || !subject || !message) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Missing required fields',
          required: ['to', 'subject', 'message']
        })
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid email address' })
      };
    }

    const transporter = getTransporter();

    const mailOptions = {
      from: `"Love Life Now" <${process.env.FROM_EMAIL}>`,
      replyTo: process.env.FROM_EMAIL,
      to: to,
      subject: subject,
      text: formatPlainText(message, originalMessage, originalDate, originalName),
      html: formatEmailHtml(message, originalMessage, originalDate, originalName)
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`Email sent to ${to}: ${info.messageId}`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        messageId: info.messageId,
        submissionId: submissionId
      })
    };

  } catch (error) {
    console.error('Email send error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to send email',
        details: error.message
      })
    };
  }
};
