const nodemailer = require('nodemailer');
const axios = require('axios');
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
  console.log('Auto-notify function triggered');

  if (!process.env.BLOOMERANG_API_KEY) {
    console.error('BLOOMERANG_API_KEY not configured');
    return { statusCode: 500, body: 'BLOOMERANG_API_KEY not configured' };
  }

  const notificationEmail = process.env.NOTIFICATION_EMAIL || process.env.FROM_EMAIL;
  if (!notificationEmail) {
    console.error('NOTIFICATION_EMAIL not configured');
    return { statusCode: 500, body: 'NOTIFICATION_EMAIL not configured' };
  }

  try {
    bloomerangApi.defaults.headers['X-API-Key'] = process.env.BLOOMERANG_API_KEY;

    // Get submissions from the last 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const response = await bloomerangApi.get('/interactions', {
      params: { take: 50, skip: 0, channel: 'Website', orderBy: 'Date', orderDirection: 'Desc' }
    });

    const allInteractions = response.data.Results || [];
    const recentSubmissions = allInteractions.filter(i => new Date(i.Date) >= tenMinutesAgo);

    console.log(`Found ${recentSubmissions.length} submissions in last 10 minutes`);

    if (recentSubmissions.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No new submissions', checked: allInteractions.length })
      };
    }

    // Fetch constituent details
    const constituentIds = [...new Set(recentSubmissions.map(i => i.AccountId).filter(Boolean))];
    let constituentsMap = {};

    if (constituentIds.length > 0) {
      try {
        const constResponse = await bloomerangApi.get('/constituents', {
          params: { take: 50, id: constituentIds }
        });
        (constResponse.data.Results || []).forEach(c => { constituentsMap[c.Id] = c; });
      } catch (err) {
        console.log('Could not fetch constituents:', err.message);
      }
    }

    // Send notifications
    const transporter = getTransporter();
    let sentCount = 0;

    for (const interaction of recentSubmissions) {
      const constituent = constituentsMap[interaction.AccountId];
      const config = getConfig(interaction.Subject);
      const submission = buildSubmissionData(interaction, constituent);

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

      try {
        await transporter.sendMail({
          from: `"Love Life Now" <${process.env.FROM_EMAIL}>`,
          to: notificationEmail,
          replyTo: submission.email ? `"${submission.name}" <${submission.email}>` : undefined,
          subject: `${config.icon} ${config.title} - ${submission.name || 'Unknown'}`,
          text: formatText(emailData),
          html: formatHtml(emailData)
        });
        console.log(`Sent notification for submission ${interaction.Id}`);
        sentCount++;
      } catch (emailError) {
        console.error(`Failed to send notification for ${interaction.Id}:`, emailError.message);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Sent ${sentCount} notifications`, found: recentSubmissions.length, sent: sentCount })
    };

  } catch (error) {
    console.error('Auto-notify error:', error.response?.data || error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Auto-notify failed', details: error.message })
    };
  }
};
