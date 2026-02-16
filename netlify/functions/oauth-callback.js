const axios = require('axios');
const crypto = require('crypto');
const cookie = require('cookie');
const { getStore } = require('@netlify/blobs');

// Handles the OAuth callback from Bloomerang
// Exchanges authorization code for access + refresh tokens
exports.handler = async (event) => {
  const code = event.queryStringParameters?.code;
  const error = event.queryStringParameters?.error;
  const state = event.queryStringParameters?.state;

  // Clear the state cookie in all responses
  const clearStateCookie = cookie.serialize('oauth_state', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 0,
    path: '/'
  });

  if (error) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html', 'Set-Cookie': clearStateCookie },
      body: '<h1>Authorization failed</h1><p>Bloomerang denied the request. Please try again.</p>'
    };
  }

  if (!code) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html', 'Set-Cookie': clearStateCookie },
      body: '<h1>Missing authorization code</h1>'
    };
  }

  // Validate state parameter against signed cookie
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html', 'Set-Cookie': clearStateCookie },
      body: '<h1>Server configuration error</h1>'
    };
  }

  const cookies = cookie.parse(event.headers.cookie || '');
  const storedState = cookies.oauth_state;

  if (!state || !storedState) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html', 'Set-Cookie': clearStateCookie },
      body: '<h1>Invalid request</h1><p>Missing state parameter. Please start the OAuth flow again.</p>'
    };
  }

  const [originalState, storedSignature] = storedState.split(':');
  const expectedSignature = crypto.createHmac('sha256', secret).update(state).digest('hex');

  // Both signatures are hex-encoded HMAC-SHA256 (always 64 chars)
  if (
    state !== originalState ||
    !storedSignature ||
    storedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(Buffer.from(storedSignature), Buffer.from(expectedSignature))
  ) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html', 'Set-Cookie': clearStateCookie },
      body: '<h1>Invalid state</h1><p>The request may have been tampered with. Please try again.</p>'
    };
  }

  const clientId = process.env.BLOOMERANG_OAUTH_CLIENT_ID;
  const clientSecret = process.env.BLOOMERANG_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.BLOOMERANG_OAUTH_REDIRECT_URI;

  try {
    // Exchange authorization code for tokens
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await axios.post(
      'https://api.bloomerang.com/v2/oauth/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      }).toString(),
      {
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;

    // Store tokens in Netlify Blobs
    const store = getStore('bloomerang-oauth');
    await store.setJSON('tokens', {
      access_token,
      refresh_token,
      expires_at: Date.now() + (expires_in * 1000),
      updated_at: new Date().toISOString()
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html', 'Set-Cookie': clearStateCookie },
      body: `
        <h1>Bloomerang OAuth Connected!</h1>
        <p>Access token and refresh token have been stored.</p>
        <p>The assign-group function can now add constituents to groups.</p>
        <p>You can close this page.</p>
      `
    };

  } catch (err) {
    console.error('OAuth token exchange error:', err.response?.status, err.response?.data || err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html', 'Set-Cookie': clearStateCookie },
      body: '<h1>Token exchange failed</h1><p>Could not exchange the authorization code. Check the server logs for details.</p>'
    };
  }
};
