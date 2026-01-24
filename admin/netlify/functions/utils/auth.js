const crypto = require('crypto');
const cookie = require('cookie');

// Verify auth token from cookie
function verifyAuth(event) {
  const cookies = cookie.parse(event.headers.cookie || '');
  const token = cookies.auth_token;

  if (!token) {
    return false;
  }

  const [timestamp, signature] = token.split(':');
  if (!timestamp || !signature) {
    return false;
  }

  // Check if token is expired (24 hours)
  const tokenAge = Date.now() - parseInt(timestamp);
  if (tokenAge > 24 * 60 * 60 * 1000) {
    return false;
  }

  // Verify signature
  const secret = process.env.SESSION_SECRET || 'default-secret';
  const data = `authenticated:${timestamp}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(data).digest('hex');

  return signature === expectedSignature;
}

// Return unauthorized response
function unauthorizedResponse() {
  return {
    statusCode: 401,
    body: JSON.stringify({ error: 'Authentication required' })
  };
}

module.exports = { verifyAuth, unauthorizedResponse };
