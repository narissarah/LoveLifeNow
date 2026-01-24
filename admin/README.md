# Love Life Now Admin Panel

A password-protected admin panel to view and reply to form submissions from Bloomerang CRM.

## Form Types Managed

- **Contact Form** - General inquiries
- **Volunteer Form** - Volunteer sign-ups
- **Book A Speaker** - Speaker requests
- **Get Safe Fund Application** - DV assistance applications
- **Donate** - Donations

## Setup

### 1. Install Dependencies

```bash
cd admin/server
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Admin Authentication
ADMIN_PASSWORD=your_secure_password_here

# Bloomerang API
BLOOMERANG_API_KEY=your_bloomerang_private_api_key

# SMTP Configuration
SMTP_HOST=smtp.your-email-provider.com
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
FROM_EMAIL=info@lovelifenow.org

# Session Configuration
SESSION_SECRET=generate_a_random_string_here

# Server Configuration
PORT=3005
```

### 3. Get Your Bloomerang API Key

1. Log in to Bloomerang
2. Go to Settings > Integrations > API Keys
3. Create a new API key with read access
4. Copy the private key to your `.env` file

### 4. Configure SMTP

For sending reply emails, you need SMTP credentials. Common options:

- **Gmail**: Use App Passwords (smtp.gmail.com, port 587)
- **SendGrid**: Use API key as password (smtp.sendgrid.net, port 587)
- **Mailgun**: Use SMTP credentials from dashboard
- **Your hosting provider**: Check their SMTP settings

## Running the Server

### Development

```bash
cd admin/server
npm run dev
```

### Production

```bash
cd admin/server
npm start
```

The server runs at `http://localhost:3005` by default.

## Usage

1. Open `http://localhost:3005` in your browser
2. Enter the admin password
3. Use the sidebar to switch between form types
4. Click "View" on any submission to see details
5. Click "Reply via Email" to send a response

## Security Notes

- Keep your `.env` file secure and never commit it to git
- Use a strong admin password
- In production, run behind HTTPS
- Consider adding rate limiting for production use

## Deployment Options

### Heroku

```bash
cd admin/server
heroku create
heroku config:set ADMIN_PASSWORD=xxx BLOOMERANG_API_KEY=xxx ...
git push heroku main
```

### Vercel/Netlify

Not recommended for this app due to session management. Use Heroku, Railway, or a traditional VPS instead.

### Local Server

Simply run `npm start` and access via localhost or configure a reverse proxy (nginx/Apache) for external access.
