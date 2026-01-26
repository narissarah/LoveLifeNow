const nodemailer = require('nodemailer');
const axios = require('axios');

// This function runs on a schedule to check for new submissions
// and automatically send email notifications

// Create axios instance for Bloomerang API
const bloomerangApi = axios.create({
  baseURL: 'https://api.bloomerang.co/v2',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Form type configuration
const FORM_CONFIG = {
  'Contact Form': { type: 'contact', icon: '✉️', title: 'New Contact Form Submission' },
  'Volunteer': { type: 'volunteer', icon: '🙋', title: 'New Volunteer Application' },
  'Book A Speaker': { type: 'speaker', icon: '🎙️', title: 'New Speaker Booking Request' },
  'GetSafeApplication': { type: 'getsafe', icon: '🏠', title: 'New Get Safe Fund Application' },
  'Donation': { type: 'donate', icon: '💝', title: 'New Donation Received' }
};

// Create SMTP transporter
function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

// Format email HTML for notification
function formatNotificationHtml(submission, config) {
  const constituent = submission.constituent || {};
  const customFields = submission.customFields || [];

  const fieldsHtml = customFields
    .filter(f => f.value && f.value.toString().trim())
    .map(f => `<tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;width:140px;"><strong>${f.name}</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${f.value}</td></tr>`)
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #7c3aed 0%, #9333ea 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #fff; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .info-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    .message-box { background: #f9fafb; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #7c3aed; }
    .footer { margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
    .reply-note { background: #fef3c7; padding: 12px; border-radius: 6px; margin-top: 15px; font-size: 13px; }
  </style>
</head>
<body>
  <div class="header">
    <h2 style="margin:0;">${config.icon} ${config.title}</h2>
    <p style="margin:5px 0 0;opacity:0.9;">Submitted on ${new Date(submission.date).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit'
    })}</p>
  </div>

  <div class="content">
    <h3 style="margin-top:0;color:#7c3aed;">Contact Information</h3>
    <table class="info-table">
      <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;width:140px;"><strong>Name</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${constituent.name || 'Not provided'}</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;"><strong>Email</strong></td><td style="padding:8px;border-bottom:1px solid #eee;"><a href="mailto:${constituent.email}">${constituent.email || 'Not provided'}</a></td></tr>
      ${constituent.phone ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;"><strong>Phone</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${constituent.phone}</td></tr>` : ''}
      ${constituent.address ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;"><strong>Address</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${constituent.address.street}, ${constituent.address.city}, ${constituent.address.state} ${constituent.address.zip}</td></tr>` : ''}
    </table>

    ${customFields.length > 0 ? `
    <h3 style="color:#7c3aed;">Form Details</h3>
    <table class="info-table">
      ${fieldsHtml}
    </table>
    ` : ''}

    ${submission.note ? `
    <h3 style="color:#7c3aed;">Message</h3>
    <div class="message-box">
      ${submission.note.replace(/\n/g, '<br>')}
    </div>
    ` : ''}

    <div class="reply-note">
      <strong>💡 Quick Reply:</strong> Simply reply to this email to respond directly to ${constituent.name || 'the submitter'}.
    </div>

    <div class="footer">
      <p>This is an automatic notification from Love Life Now.<br>
      <a href="https://lovelifenow.netlify.app/admin/dashboard">View in Admin Dashboard →</a></p>
    </div>
  </div>
</body>
</html>
  `;
}

// Format plain text version
function formatNotificationText(submission, config) {
  const constituent = submission.constituent || {};
  const customFields = submission.customFields || [];

  let text = `${config.title}\n`;
  text += `${'='.repeat(40)}\n\n`;
  text += `Submitted: ${new Date(submission.date).toLocaleString()}\n\n`;
  text += `CONTACT INFORMATION\n`;
  text += `-`.repeat(20) + `\n`;
  text += `Name: ${constituent.name || 'Not provided'}\n`;
  text += `Email: ${constituent.email || 'Not provided'}\n`;
  if (constituent.phone) text += `Phone: ${constituent.phone}\n`;
  if (constituent.address) {
    text += `Address: ${constituent.address.street}, ${constituent.address.city}, ${constituent.address.state} ${constituent.address.zip}\n`;
  }

  if (customFields.length > 0) {
    text += `\nFORM DETAILS\n`;
    text += `-`.repeat(20) + `\n`;
    customFields.filter(f => f.value).forEach(f => {
      text += `${f.name}: ${f.value}\n`;
    });
  }

  if (submission.note) {
    text += `\nMESSAGE\n`;
    text += `-`.repeat(20) + `\n`;
    text += submission.note + '\n';
  }

  text += `\n---\nReply to this email to respond directly to ${constituent.name || 'the submitter'}.\n`;
  text += `View in Admin: https://lovelifenow.netlify.app/admin/dashboard\n`;

  return text;
}

// Get form config from subject
function getFormConfig(subject) {
  for (const [pattern, config] of Object.entries(FORM_CONFIG)) {
    if (subject && subject.includes(pattern)) {
      return config;
    }
  }
  return { type: 'unknown', icon: '📋', title: 'New Form Submission' };
}

exports.handler = async (event) => {
  console.log('Auto-notify function triggered');

  // Check required environment variables
  if (!process.env.BLOOMERANG_API_KEY) {
    console.error('BLOOMERANG_API_KEY not configured');
    return { statusCode: 500, body: 'BLOOMERANG_API_KEY not configured' };
  }

  if (!process.env.NOTIFICATION_EMAIL && !process.env.FROM_EMAIL) {
    console.error('NOTIFICATION_EMAIL not configured');
    return { statusCode: 500, body: 'NOTIFICATION_EMAIL not configured' };
  }

  try {
    bloomerangApi.defaults.headers['X-API-Key'] = process.env.BLOOMERANG_API_KEY;

    // Get submissions from the last 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const response = await bloomerangApi.get('/interactions', {
      params: {
        take: 50,
        skip: 0,
        channel: 'Website',
        orderBy: 'Date',
        orderDirection: 'Desc'
      }
    });

    const allInteractions = response.data.Results || [];

    // Filter to only recent submissions (last 10 minutes)
    const recentSubmissions = allInteractions.filter(i => {
      const submissionDate = new Date(i.Date);
      return submissionDate >= tenMinutesAgo;
    });

    console.log(`Found ${recentSubmissions.length} submissions in last 10 minutes`);

    if (recentSubmissions.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No new submissions', checked: allInteractions.length })
      };
    }

    // Fetch constituent details for all submissions
    const constituentIds = [...new Set(recentSubmissions.map(i => i.AccountId).filter(Boolean))];
    let constituentsMap = {};

    if (constituentIds.length > 0) {
      try {
        const constResponse = await bloomerangApi.get('/constituents', {
          params: { take: 50, id: constituentIds }
        });
        (constResponse.data.Results || []).forEach(c => {
          constituentsMap[c.Id] = c;
        });
      } catch (err) {
        console.log('Could not fetch constituents:', err.message);
      }
    }

    // Send notifications
    const transporter = getTransporter();
    const notificationEmail = process.env.NOTIFICATION_EMAIL || process.env.FROM_EMAIL;
    let sentCount = 0;

    for (const interaction of recentSubmissions) {
      const constituent = constituentsMap[interaction.AccountId];
      const config = getFormConfig(interaction.Subject);

      const submission = {
        id: interaction.Id,
        date: interaction.Date,
        subject: interaction.Subject,
        note: interaction.Note || '',
        constituent: constituent ? {
          id: constituent.Id,
          name: `${constituent.FirstName || ''} ${constituent.LastName || ''}`.trim(),
          email: constituent.PrimaryEmail?.Value || null,
          phone: constituent.PrimaryPhone?.Number || null,
          address: constituent.PrimaryAddress ? {
            street: constituent.PrimaryAddress.Street || '',
            city: constituent.PrimaryAddress.City || '',
            state: constituent.PrimaryAddress.State || '',
            zip: constituent.PrimaryAddress.PostalCode || ''
          } : null
        } : null,
        customFields: (interaction.CustomValues || []).map(cv => ({
          name: cv.FieldText || cv.FieldId,
          value: cv.Value?.Value || cv.Value || ''
        }))
      };

      const submitterEmail = submission.constituent?.email;
      const submitterName = submission.constituent?.name || 'Form Submitter';

      try {
        await transporter.sendMail({
          from: `"Love Life Now" <${process.env.FROM_EMAIL}>`,
          to: notificationEmail,
          replyTo: submitterEmail ? `"${submitterName}" <${submitterEmail}>` : undefined,
          subject: `${config.icon} ${config.title} - ${submitterName}`,
          text: formatNotificationText(submission, config),
          html: formatNotificationHtml(submission, config)
        });

        console.log(`Sent notification for submission ${interaction.Id}`);
        sentCount++;
      } catch (emailError) {
        console.error(`Failed to send notification for ${interaction.Id}:`, emailError.message);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Sent ${sentCount} notifications`,
        found: recentSubmissions.length,
        sent: sentCount
      })
    };

  } catch (error) {
    console.error('Auto-notify error:', error.response?.data || error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Auto-notify failed',
        details: error.message
      })
    };
  }
};
