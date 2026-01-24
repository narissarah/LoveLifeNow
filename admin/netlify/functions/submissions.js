const axios = require('axios');
const { verifyAuth, unauthorizedResponse } = require('./utils/auth');

// Form type to Channel ID mapping
const FORM_CHANNELS = {
  contact: 1050624,
  volunteer: 1048576,
  speaker: 763905,
  getsafe: 748544,
  donate: 535552
};

// Create axios instance for Bloomerang API
const bloomerangApi = axios.create({
  baseURL: 'https://api.bloomerang.co/v2',
  headers: {
    'Content-Type': 'application/json'
  }
});

exports.handler = async (event) => {
  // Check authentication
  if (!verifyAuth(event)) {
    return unauthorizedResponse();
  }

  // Parse form type from query parameter or path
  const params = event.queryStringParameters || {};
  let formType = params.type;

  // Fallback: try to get from path (for backwards compatibility)
  if (!formType) {
    const pathParts = event.path.split('/');
    formType = pathParts[pathParts.length - 1];
    // If it's just "submissions", no type provided
    if (formType === 'submissions') formType = null;
  }

  const channelId = FORM_CHANNELS[formType];
  if (!channelId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Invalid form type',
        validTypes: Object.keys(FORM_CHANNELS)
      })
    };
  }

  try {
    // Set API key from environment
    bloomerangApi.defaults.headers['X-API-Key'] = process.env.BLOOMERANG_API_KEY;

    // Fetch interactions filtered by channel
    const response = await bloomerangApi.get('/interactions', {
      params: {
        take: 50,
        skip: 0,
        channel: channelId,
        orderBy: 'Date',
        orderDirection: 'Desc'
      }
    });

    const interactions = response.data.Results || [];

    // Enrich with constituent details
    const enrichedSubmissions = await Promise.all(
      interactions.map(async (interaction) => {
        let constituent = null;
        if (interaction.AccountId) {
          try {
            const constResponse = await bloomerangApi.get(`/constituents/${interaction.AccountId}`);
            constituent = constResponse.data;
          } catch (err) {
            console.error(`Failed to fetch constituent ${interaction.AccountId}:`, err.message);
          }
        }

        return {
          id: interaction.Id,
          date: interaction.Date,
          subject: interaction.Subject || 'No Subject',
          note: interaction.Note || '',
          channel: interaction.Channel,
          constituent: constituent ? {
            id: constituent.Id,
            name: `${constituent.FirstName || ''} ${constituent.LastName || ''}`.trim(),
            email: constituent.PrimaryEmail?.Value || null,
            phone: constituent.PrimaryPhone?.Number || null
          } : null,
          customFields: interaction.CustomFields || []
        };
      })
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formType,
        total: response.data.Total || enrichedSubmissions.length,
        submissions: enrichedSubmissions
      })
    };

  } catch (error) {
    console.error('Bloomerang API error:', error.response?.data || error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to fetch submissions',
        details: error.response?.data?.Message || error.message
      })
    };
  }
};
