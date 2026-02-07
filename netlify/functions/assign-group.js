const axios = require('axios');
const { getStore } = require('@netlify/blobs');

// Form name to Bloomerang Group ID mapping
const FORM_GROUP_MAP = {
  'book-a-speaker': 1298433,
  'contact-us': 1299457,
  'donate': 1300481,
  'get-safe-fund': 32769,
  'newsletter': 1302529,
  'volunteer': 1303553
};

// Get a valid OAuth access token, refreshing if expired
async function getAccessToken(store) {
  const tokens = await store.getJSON('tokens');
  if (!tokens) {
    throw new Error('No OAuth tokens found. Visit /api/oauth-start to authorize.');
  }

  // If token is still valid (with 5-min buffer), return it
  if (tokens.expires_at > Date.now() + 300000) {
    return tokens.access_token;
  }

  // Refresh the token
  const clientId = process.env.BLOOMERANG_OAUTH_CLIENT_ID;
  const clientSecret = process.env.BLOOMERANG_OAUTH_CLIENT_SECRET;
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await axios.post(
    'https://api.bloomerang.com/v2/oauth/token',
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token
    }).toString(),
    {
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  const { access_token, refresh_token, expires_in } = response.data;

  // Store updated tokens
  await store.setJSON('tokens', {
    access_token,
    refresh_token,
    expires_at: Date.now() + (expires_in * 1000),
    updated_at: new Date().toISOString()
  });

  return access_token;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { constituentId, formName } = JSON.parse(event.body || '{}');

    if (!constituentId || !formName) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Missing required fields: constituentId and formName',
          validFormNames: Object.keys(FORM_GROUP_MAP)
        })
      };
    }

    const groupId = FORM_GROUP_MAP[formName];
    if (!groupId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: `Invalid formName: ${formName}`,
          validFormNames: Object.keys(FORM_GROUP_MAP)
        })
      };
    }

    const store = getStore('bloomerang-oauth');
    const accessToken = await getAccessToken(store);

    // Try the internal CRM endpoint first (discovered from browser inspection)
    try {
      const crmResponse = await axios.post(
        'https://crm.bloomerang.co/Groups/Home/AddMembersToExistingGroup',
        {
          accountIds: [parseInt(constituentId)],
          groupId: groupId,
          searchSpec: { filterModel: {} },
          selectAll: false
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          method: 'crm-internal',
          constituentId,
          formName,
          groupId,
          response: crmResponse.data
        })
      };
    } catch (crmError) {
      console.log('CRM internal endpoint failed, trying public API fallback:', crmError.response?.status);

      // Fallback: try public API with OAuth token
      try {
        await axios.put(
          `https://api.bloomerang.co/v2/constituent/${constituentId}/group/${groupId}`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            method: 'public-api-oauth',
            constituentId,
            formName,
            groupId
          })
        };
      } catch (apiError) {
        console.error('Both endpoints failed.');
        console.error('CRM error:', crmError.response?.status, crmError.response?.data);
        console.error('API error:', apiError.response?.status, apiError.response?.data);
        throw apiError;
      }
    }

  } catch (error) {
    console.error('Assign group error:', error.response?.data || error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to assign group',
        details: error.response?.data?.Message || error.message
      })
    };
  }
};
