const axios = require('axios');
const { verifyAuth, unauthorizedResponse } = require('./utils/auth');

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

  // Parse form type from query parameter
  const params = event.queryStringParameters || {};
  const formType = params.type;

  if (!formType) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Form type required' })
    };
  }

  try {
    // Set API key from environment
    bloomerangApi.defaults.headers['X-API-Key'] = process.env.BLOOMERANG_API_KEY;

    // Fetch website interactions (form submissions)
    const response = await bloomerangApi.get('/interactions', {
      params: {
        take: 50,
        skip: 0,
        channel: 'Website',
        orderBy: 'Date',
        orderDirection: 'Desc'
      }
    });

    const allInteractions = response.data.Results || [];

    // Enrich with constituent details
    const enrichedSubmissions = await Promise.all(
      allInteractions.map(async (interaction) => {
        let constituent = null;
        if (interaction.AccountId) {
          try {
            const constResponse = await bloomerangApi.get(`/constituents/${interaction.AccountId}`);
            constituent = constResponse.data;
          } catch (err) {
            // Silently skip constituent fetch errors
          }
        }

        return {
          id: interaction.Id,
          date: interaction.Date,
          subject: interaction.Subject || 'No Subject',
          note: interaction.Note || '',
          channel: interaction.Channel,
          purpose: interaction.Purpose,
          isInbound: interaction.IsInbound,
          constituent: constituent ? {
            id: constituent.Id,
            name: `${constituent.FirstName || ''} ${constituent.LastName || ''}`.trim(),
            email: constituent.PrimaryEmail?.Value || null,
            phone: constituent.PrimaryPhone?.Number || null
          } : null,
          customFields: interaction.CustomFields || [],
          // Include raw data for debugging
          raw: {
            Purpose: interaction.Purpose,
            Subject: interaction.Subject,
            CustomFieldsCount: (interaction.CustomFields || []).length
          }
        };
      })
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formType,
        total: enrichedSubmissions.length,
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
