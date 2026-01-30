const axios = require('axios');

// Form name to Bloomerang Group ID mapping
const FORM_GROUP_MAP = {
  'book-a-speaker': 1298433,
  'contact-us': 1299457,
  'donate': 1300481,
  'get-safe-fund': 32769,
  'newsletter': 1302529,
  'volunteer': 1303553
};

// Create axios instance for Bloomerang API
const bloomerangApi = axios.create({
  baseURL: 'https://api.bloomerang.co/v2',
  headers: {
    'Content-Type': 'application/json'
  }
});

exports.handler = async (event) => {
  // Only allow POST
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

    // Set API key from environment
    bloomerangApi.defaults.headers['X-API-Key'] = process.env.BLOOMERANG_API_KEY;

    // Add constituent to group via Bloomerang REST API
    await bloomerangApi.put(`/constituent/${constituentId}/group/${groupId}`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        constituentId,
        formName,
        groupId
      })
    };

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
