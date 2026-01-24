# Love Life Now Admin Panel

A password-protected admin panel to view and reply to form submissions from Bloomerang CRM.

## Form Types Managed

- **Contact Form** - General inquiries
- **Volunteer Form** - Volunteer sign-ups
- **Book A Speaker** - Speaker requests
- **Get Safe Fund Application** - DV assistance applications
- **Donate** - Donations

## Deployment on Netlify

### 1. Connect to Netlify

1. Go to [Netlify](https://app.netlify.com)
2. Click "Add new site" > "Import an existing project"
3. Connect your GitHub repository
4. Set the **Base directory** to: `admin`
5. Build settings will be auto-detected from `netlify.toml`

### 2. Configure Environment Variables

In Netlify dashboard, go to **Site settings** > **Environment variables** and add:

| Variable | Description |
|----------|-------------|
| `ADMIN_PASSWORD` | Your admin login password |
| `BLOOMERANG_API_KEY` | Your Bloomerang private API key |
| `SESSION_SECRET` | Random string for signing auth tokens |
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP port (usually 587) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `FROM_EMAIL` | Sender email address |

### 3. Deploy

Netlify will automatically deploy when you push to your repository.

## Get Your Bloomerang API Key

1. Log in to Bloomerang
2. Go to Settings > Integrations > API Keys
3. Create a new API key with read access
4. Copy the private key to Netlify environment variables

## SMTP Configuration

For sending reply emails, you need SMTP credentials. Common options:

- **Gmail**: Use App Passwords (smtp.gmail.com, port 587)
- **SendGrid**: Use API key as password (smtp.sendgrid.net, port 587)
- **Mailgun**: Use SMTP credentials from dashboard

## Usage

1. Visit your Netlify site URL
2. Enter the admin password
3. Use the sidebar to switch between form types
4. Click "View" on any submission to see details
5. Click "Reply via Email" to send a response

## Local Development

For local testing, you can still use the Express server:

```bash
cd admin/server
npm install
cp .env.example .env
# Edit .env with your values
npm start
```

Then visit `http://localhost:3005`

## Project Structure

```
admin/
├── netlify.toml          # Netlify configuration
├── package.json          # Dependencies for Netlify Functions
├── public/               # Static frontend files
│   ├── index.html        # Login page
│   ├── dashboard.html    # Main dashboard
│   ├── css/admin.css     # Styles
│   └── js/               # Frontend JavaScript
├── netlify/functions/    # Serverless functions
│   ├── auth-login.js     # Login endpoint
│   ├── auth-logout.js    # Logout endpoint
│   ├── auth-check.js     # Auth verification
│   ├── submissions.js    # Fetch form submissions
│   ├── email-reply.js    # Send reply emails
│   └── utils/auth.js     # Shared auth utilities
└── server/               # Express server (for local dev)
```

## Security Notes

- Environment variables are securely stored in Netlify
- Auth tokens are signed with HMAC-SHA256
- Cookies are httpOnly and secure in production
- Never commit sensitive credentials to git
