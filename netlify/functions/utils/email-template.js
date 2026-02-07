// Shared email template for all notification functions
// Used by: form-notify.js, auto-notify.js, notify-submission.js

const FORM_CONFIG = {
  // Form-name keys (used by form-notify.js)
  'book-a-speaker': { icon: '🎙️', title: 'New Speaker Booking Request' },
  'contact-us':     { icon: '✉️', title: 'New Contact Form Submission' },
  'donate':         { icon: '💝', title: 'New Donation Received' },
  'get-safe-fund':  { icon: '🏠', title: 'New Get Safe Fund Application' },
  'newsletter':     { icon: '📰', title: 'New Newsletter Signup' },
  'volunteer':      { icon: '🙋', title: 'New Volunteer Application' },
  // Bloomerang Subject patterns (used by auto-notify.js)
  'Contact Form':        { icon: '✉️', title: 'New Contact Form Submission' },
  'Volunteer':           { icon: '🙋', title: 'New Volunteer Application' },
  'Book A Speaker':      { icon: '🎙️', title: 'New Speaker Booking Request' },
  'GetSafeApplication':  { icon: '🏠', title: 'New Get Safe Fund Application' },
  'Donation':            { icon: '💝', title: 'New Donation Received' },
  'Newsletter':          { icon: '📰', title: 'New Newsletter Signup' },
  // Short keys (used by notify-submission.js)
  'contact':   { icon: '✉️', title: 'New Contact Form Submission' },
  'speaker':   { icon: '🎙️', title: 'New Speaker Booking Request' },
  'getsafe':   { icon: '🏠', title: 'New Get Safe Fund Application' },
};

function getConfig(key) {
  if (FORM_CONFIG[key]) return FORM_CONFIG[key];
  // Try matching Bloomerang Subject patterns
  for (const [pattern, config] of Object.entries(FORM_CONFIG)) {
    if (key && key.includes(pattern)) return config;
  }
  return { icon: '📋', title: 'New Form Submission' };
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Shared HTML template ──────────────────────────────────────

function formatHtml({ name, email, phone, address, date, customFields, message, constituentId, config }) {
  const displayName = name || 'Not provided';
  const displayDate = date
    ? new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const bloomerangLink = constituentId ? `https://crm.bloomerang.co/Constituent/${constituentId}` : null;

  const contactRows = [
    { label: 'Name', value: displayName },
    { label: 'Email', value: email ? `<a href="mailto:${escapeHtml(email)}" style="color:#801C80;text-decoration:none;">${escapeHtml(email)}</a>` : 'Not provided', raw: true },
    phone ? { label: 'Phone', value: escapeHtml(phone) } : null,
    address ? { label: 'Address', value: escapeHtml(typeof address === 'object' ? `${address.street}, ${address.city}, ${address.state} ${address.zip}` : address) } : null,
  ].filter(Boolean);

  const fields = (customFields || []).filter(f => f.value && String(f.value).trim());

  function tableRows(rows, raw) {
    return rows.map((r, i) => {
      const bg = i % 2 === 0 ? '#f9fafb' : '#ffffff';
      const val = raw || r.raw ? r.value : escapeHtml(String(r.value));
      return `<tr style="background:${bg};">
        <td style="padding:10px 14px;color:#6b7280;font-size:13px;font-weight:600;width:130px;vertical-align:top;border-bottom:1px solid #f3f4f6;">${r.raw ? r.label : escapeHtml(r.label)}</td>
        <td style="padding:10px 14px;color:#1f2937;font-size:14px;border-bottom:1px solid #f3f4f6;">${val}</td>
      </tr>`;
    }).join('');
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#801C80 0%,#6a176a 100%);padding:28px 30px;">
          <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">${config.icon}  ${config.title}</h1>
          <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">${displayDate}</p>
        </td></tr>

        <!-- Contact Info -->
        <tr><td style="padding:24px 30px 0;">
          <h2 style="margin:0 0 12px;font-size:13px;font-weight:700;color:#801C80;text-transform:uppercase;letter-spacing:0.8px;">Contact Information</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            ${tableRows(contactRows, true)}
          </table>
        </td></tr>

        ${fields.length > 0 ? `
        <!-- Form Details -->
        <tr><td style="padding:24px 30px 0;">
          <h2 style="margin:0 0 12px;font-size:13px;font-weight:700;color:#801C80;text-transform:uppercase;letter-spacing:0.8px;">Form Details</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            ${tableRows(fields.map(f => ({ label: f.name, value: f.value })))}
          </table>
        </td></tr>
        ` : ''}

        ${message ? `
        <!-- Message -->
        <tr><td style="padding:24px 30px 0;">
          <h2 style="margin:0 0 12px;font-size:13px;font-weight:700;color:#801C80;text-transform:uppercase;letter-spacing:0.8px;">Message</h2>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-left:4px solid #801C80;border-radius:8px;padding:16px;font-size:14px;line-height:1.7;color:#374151;">
            ${escapeHtml(message).replace(/\n/g, '<br>')}
          </div>
        </td></tr>
        ` : ''}

        <!-- Actions -->
        <tr><td style="padding:24px 30px 0;">
          <table cellpadding="0" cellspacing="0"><tr>
            ${bloomerangLink ? `<td style="padding-right:10px;">
              <a href="${bloomerangLink}" style="display:inline-block;padding:10px 20px;background:#801C80;color:#ffffff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">View in Bloomerang CRM &rarr;</a>
            </td>` : ''}
            <td>
              <a href="https://lovelifenow.netlify.app/admin/dashboard" style="display:inline-block;padding:10px 20px;background:#ffffff;color:#801C80;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;border:1px solid #801C80;">Admin Dashboard &rarr;</a>
            </td>
          </tr></table>
        </td></tr>

        ${email ? `
        <!-- Reply Note -->
        <tr><td style="padding:20px 30px 0;">
          <div style="background:#fae8fa;border:1px solid #f0d0f0;border-radius:8px;padding:12px 16px;font-size:13px;color:#6a176a;">
            <strong>Quick Reply:</strong> Simply reply to this email to respond directly to ${escapeHtml(displayName)}.
          </div>
        </td></tr>
        ` : ''}

        <!-- Footer -->
        <tr><td style="padding:20px 30px 24px;">
          <p style="margin:0;font-size:11px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:16px;">
            Love Life Now Foundation &middot; Automatic notification
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Shared plain text template ────────────────────────────────

function formatText({ name, email, phone, address, date, customFields, message, constituentId, config }) {
  const displayName = name || 'Not provided';
  let text = `${config.icon} ${config.title}\n`;
  text += '='.repeat(44) + '\n\n';
  text += `Submitted: ${date ? new Date(date).toLocaleString() : new Date().toLocaleString()}\n\n`;

  text += 'CONTACT INFORMATION\n';
  text += '-'.repeat(22) + '\n';
  text += `Name:  ${displayName}\n`;
  text += `Email: ${email || 'Not provided'}\n`;
  if (phone) text += `Phone: ${phone}\n`;
  if (address) {
    const addr = typeof address === 'object' ? `${address.street}, ${address.city}, ${address.state} ${address.zip}` : address;
    text += `Address: ${addr}\n`;
  }

  const fields = (customFields || []).filter(f => f.value && String(f.value).trim());
  if (fields.length > 0) {
    text += '\nFORM DETAILS\n';
    text += '-'.repeat(22) + '\n';
    fields.forEach(f => { text += `${f.name}: ${f.value}\n`; });
  }

  if (message) {
    text += '\nMESSAGE\n';
    text += '-'.repeat(22) + '\n';
    text += message + '\n';
  }

  if (constituentId) {
    text += `\nBloomerang CRM: https://crm.bloomerang.co/Constituent/${constituentId}\n`;
  }

  if (email) text += `\n---\nReply to this email to respond directly to ${displayName}.\n`;
  text += 'Admin Dashboard: https://lovelifenow.netlify.app/admin/dashboard\n';
  return text;
}

// ── Helper: build submission data from Bloomerang interaction ──

function buildSubmissionData(interaction, constituent) {
  // Interaction custom fields (form-specific fields)
  const interactionFields = (interaction.CustomValues || []).map(cv => ({
    name: cv.FieldText || cv.FieldId || 'Field',
    value: cv.Value?.Value || cv.Value || ''
  }));

  // Constituent custom fields (demographics like age, race, ethnicity)
  const constituentFields = (constituent?.CustomValues || []).map(cv => ({
    name: cv.FieldText || cv.FieldId || 'Field',
    value: cv.Value?.Value || cv.Value || ''
  })).filter(f => f.value && String(f.value).trim());

  // Merge both sets — constituent demographics + interaction form fields
  const allCustomFields = [...constituentFields, ...interactionFields];

  // Fallback name from interaction if constituent not found
  const constituentName = constituent
    ? `${constituent.FirstName || ''} ${constituent.LastName || ''}`.trim()
    : interaction.AccountName || null;

  return {
    name: constituentName,
    email: constituent?.PrimaryEmail?.Value || null,
    phone: constituent?.PrimaryPhone?.Number || null,
    address: constituent?.PrimaryAddress ? {
      street: constituent.PrimaryAddress.Street || '',
      city: constituent.PrimaryAddress.City || '',
      state: constituent.PrimaryAddress.State || '',
      zip: constituent.PrimaryAddress.PostalCode || ''
    } : null,
    date: interaction.Date,
    constituentId: constituent?.Id || interaction.AccountId || null,
    note: interaction.Note || '',
    customFields: allCustomFields
  };
}

module.exports = { FORM_CONFIG, getConfig, escapeHtml, formatHtml, formatText, buildSubmissionData };
