const crypto = require('crypto');
const cookie = require('cookie');

// Create a signed auth token
function createAuthToken(secret) {
  const timestamp = Date.now();
  const data = `authenticated:${timestamp}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return `${timestamp}:${signature}`;
}

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { password } = JSON.parse(event.body || '{}');

    if (!password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Password is required' })
      };
    }

    if (password === process.env.ADMIN_PASSWORD) {
      const token = createAuthToken(process.env.SESSION_SECRET || 'default-secret');

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookie.serialize('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24, // 24 hours
            path: '/'
          })
        },
        body: JSON.stringify({ success: true, message: 'Login successful' })
      };
    } else {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid password' })
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server error' })
    };
  }
};
