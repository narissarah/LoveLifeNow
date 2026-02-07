const axios = require('axios');
const { getStore } = require('@netlify/blobs');

// Handles the OAuth callback from Bloomerang
// Exchanges authorization code for access + refresh tokens
exports.handler = async (event) => {
  const code = event.queryStringParameters?.code;
  const error = event.queryStringParameters?.error;

  if (error) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html' },
      body: `<h1>Authorization failed</h1><p>${error}</p>`
    };
  }

  if (!code) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html' },
      body: '<h1>Missing authorization code</h1>'
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
      headers: { 'Content-Type': 'text/html' },
      body: `
        <h1>Bloomerang OAuth Connected!</h1>
        <p>Access token and refresh token have been stored.</p>
        <p>The assign-group function can now add constituents to groups.</p>
        <p>You can close this page.</p>
      `
    };

  } catch (err) {
    console.error('OAuth token exchange error:', err.response?.data || err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html' },
      body: `<h1>Token exchange failed</h1><pre>${JSON.stringify(err.response?.data || err.message, null, 2)}</pre>`
    };
  }
};
