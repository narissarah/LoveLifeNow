const crypto = require('crypto');
const cookie = require('cookie');

// Redirects user to Bloomerang OAuth authorization page
exports.handler = async (event) => {
  const clientId = process.env.BLOOMERANG_OAUTH_CLIENT_ID;
  const redirectUri = process.env.BLOOMERANG_OAUTH_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Missing BLOOMERANG_OAUTH_CLIENT_ID or BLOOMERANG_OAUTH_REDIRECT_URI env vars'
      })
    };
  }

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'SESSION_SECRET not configured' })
    };
  }

  // Cryptographically random state to prevent CSRF on the callback
  const state = crypto.randomBytes(32).toString('hex');
  const signature = crypto.createHmac('sha256', secret).update(state).digest('hex');

  const authUrl = `https://crm.bloomerang.com/Authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=OrgAdmin`;

  return {
    statusCode: 302,
    headers: {
      Location: authUrl,
      'Set-Cookie': cookie.serialize('oauth_state', `${state}:${signature}`, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 600, // 10 minutes
        path: '/'
      })
    }
  };
};
