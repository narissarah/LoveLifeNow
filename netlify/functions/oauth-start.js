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

  const state = Date.now().toString(36);
  const authUrl = `https://crm.bloomerang.com/Authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=OrgAdmin`;

  return {
    statusCode: 302,
    headers: { Location: authUrl }
  };
};
