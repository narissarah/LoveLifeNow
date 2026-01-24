const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// Create reusable transporter
let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  return transporter;
}

/**
 * POST /api/email/reply
 * Send a reply email to a form submitter
 */
router.post('/reply', requireAuth, async (req, res) => {
  const { to, subject, message, submissionId } = req.body;

  // Validate required fields
  if (!to || !subject || !message) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['to', 'subject', 'message']
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  try {
    const mailTransporter = getTransporter();

    const mailOptions = {
      from: `"Love Life Now" <${process.env.FROM_EMAIL}>`,
      to: to,
      subject: subject,
      text: message,
      html: formatEmailHtml(message)
    };

    const info = await mailTransporter.sendMail(mailOptions);

    console.log(`Email sent to ${to}: ${info.messageId}`);

    res.json({
      success: true,
      messageId: info.messageId,
      submissionId: submissionId
    });

  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({
      error: 'Failed to send email',
      details: error.message
    });
  }
});

/**
 * POST /api/email/test
 * Test SMTP configuration
 */
router.post('/test', requireAuth, async (req, res) => {
  try {
    const mailTransporter = getTransporter();
    await mailTransporter.verify();
    res.json({ success: true, message: 'SMTP connection verified' });
  } catch (error) {
    console.error('SMTP test error:', error);
    res.status(500).json({
      error: 'SMTP connection failed',
      details: error.message
    });
  }
});

/**
 * Format plain text message as simple HTML
 */
function formatEmailHtml(message) {
  const escapedMessage = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

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
      </style>
    </head>
    <body>
      <div>${escapedMessage}</div>
      <div class="footer">
        <p>Love Life Now<br>
        Helping survivors of domestic violence</p>
      </div>
    </body>
    </html>
  `;
}

module.exports = router;
