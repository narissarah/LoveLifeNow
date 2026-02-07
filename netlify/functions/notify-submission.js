const nodemailer = require('nodemailer');
const axios = require('axios');
const { verifyAuth, unauthorizedResponse } = require('./utils/auth');
const { getConfig, formatHtml, formatText, buildSubmissionData } = require('./utils/email-template');

const bloomerangApi = axios.create({
  baseURL: 'https://api.bloomerang.co/v2',
  headers: { 'Content-Type': 'application/json' }
});

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

  if (!verifyAuth(event)) {
    return unauthorizedResponse();
  }

  try {
    const { submissionId, formType } = JSON.parse(event.body || '{}');

    if (!submissionId || !formType) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing submissionId or formType' })
      };
    }

    const config = getConfig(formType);

    bloomerangApi.defaults.headers['X-API-Key'] = process.env.BLOOMERANG_API_KEY;

    // Fetch the interaction
    const response = await bloomerangApi.get(`/interactions/${submissionId}`);
    const interaction = response.data;

    // Fetch constituent details
    let constituent = null;
    if (interaction.AccountId) {
      try {
        const constResponse = await bloomerangApi.get('/constituents', {
          params: { take: 1, id: [interaction.AccountId] }
        });
        constituent = constResponse.data.Results?.[0] || null;
      } catch (err) {
        console.log('Could not fetch constituent:', err.message);
      }
    }

    const submission = buildSubmissionData(interaction, constituent);

    const notificationEmail = process.env.NOTIFICATION_EMAIL || process.env.FROM_EMAIL;
    if (!notificationEmail) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'NOTIFICATION_EMAIL not configured' })
      };
    }

    const emailData = {
      name: submission.name || 'Unknown',
      email: submission.email,
      phone: submission.phone,
      address: submission.address,
      date: submission.date,
      customFields: submission.customFields,
      message: submission.note || null,
      constituentId: submission.constituentId,
      config
    };

    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: `"Love Life Now" <${process.env.FROM_EMAIL}>`,
      to: notificationEmail,
      replyTo: submission.email ? `"${submission.name}" <${submission.email}>` : undefined,
      subject: `${config.icon} ${config.title} - ${submission.name || 'Unknown'}`,
      text: formatText(emailData),
      html: formatHtml(emailData)
    });

    console.log(`Notification sent for submission ${submissionId}: ${info.messageId}`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        messageId: info.messageId,
        sentTo: notificationEmail,
        replyTo: submission.email
      })
    };

  } catch (error) {
    console.error('Notification error:', error.response?.data || error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to send notification',
        details: error.response?.data?.Message || error.message
      })
    };
  }
};
