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

    const adminPassword = process.env.ADMIN_PASSWORD;
    const secret = process.env.SESSION_SECRET;

    if (!adminPassword || !secret) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Timing-safe password comparison
    const passwordBuf = Buffer.from(password);
    const adminBuf = Buffer.from(adminPassword);
    const isValid = passwordBuf.length === adminBuf.length &&
      crypto.timingSafeEqual(passwordBuf, adminBuf);

    if (isValid) {
      const token = createAuthToken(secret);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookie.serialize('auth_token', token, {
            httpOnly: true,
            secure: true,
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
