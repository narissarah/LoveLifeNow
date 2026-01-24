const axios = require('axios');
const { verifyAuth, unauthorizedResponse } = require('./utils/auth');

// Form type to Subject pattern mapping
const FORM_SUBJECTS = {
  contact: 'Contact Form',
  volunteer: 'Volunteer',
  speaker: 'Book A Speaker',
  getsafe: 'GetSafeApplication',
  donate: 'Donation'
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

  // Parse form type from query parameter
  const params = event.queryStringParameters || {};
  const formType = params.type;

  const subjectPattern = FORM_SUBJECTS[formType];
  if (!subjectPattern) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Invalid form type',
        validTypes: Object.keys(FORM_SUBJECTS)
      })
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

    // Filter by subject pattern
    const filteredInteractions = allInteractions.filter(i =>
      i.Subject && i.Subject.includes(subjectPattern)
    );

    // Debug: Return first raw interaction and constituent to see structure
    if (params.debug === 'true' && filteredInteractions.length > 0) {
      const firstInteraction = filteredInteractions[0];
      let rawConstituent = null;
      if (firstInteraction.AccountId) {
        try {
          const constResp = await bloomerangApi.get(`/constituents/${firstInteraction.AccountId}`);
          rawConstituent = constResp.data;
        } catch (e) {
          rawConstituent = { error: e.message };
        }
      }
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          debug: true,
          rawInteraction: firstInteraction,
          rawConstituent: rawConstituent,
          allInteractionKeys: Object.keys(firstInteraction),
          allConstituentKeys: rawConstituent ? Object.keys(rawConstituent) : []
        })
      };
    }

    // Enrich with constituent details
    const enrichedSubmissions = await Promise.all(
      filteredInteractions.map(async (interaction) => {
        let constituent = null;
        const constituentId = interaction.AccountId;

        if (constituentId) {
          try {
            const constResponse = await bloomerangApi.get(`/constituents/${constituentId}`);
            constituent = constResponse.data;
          } catch (err) {
            console.log('Constituent fetch error:', err.message);
          }
        }

        // Extract custom field values from CustomValues array
        // Bloomerang stores form fields as CustomValues, not CustomFields
        const customFields = (interaction.CustomValues || []).map(cv => ({
          name: cv.FieldText || cv.FieldId,
          value: cv.Value?.Value || cv.Value || ''
        }));

        // Find message/note from custom values if not in Note field
        let message = interaction.Note || '';
        const messageField = customFields.find(f =>
          f.name?.toLowerCase().includes('message') ||
          f.name?.toLowerCase().includes('comment') ||
          f.name?.toLowerCase().includes('note')
        );
        if (!message && messageField) {
          message = messageField.value;
        }

        return {
          id: interaction.Id,
          date: interaction.Date,
          subject: interaction.Subject || 'No Subject',
          note: message,
          constituent: constituent ? {
            id: constituent.Id,
            name: `${constituent.FirstName || ''} ${constituent.LastName || ''}`.trim(),
            email: constituent.PrimaryEmail?.Value || null,
            phone: constituent.PrimaryPhone?.Number || null,
            // Include additional constituent fields
            address: constituent.PrimaryAddress ? {
              street: constituent.PrimaryAddress.Street || '',
              city: constituent.PrimaryAddress.City || '',
              state: constituent.PrimaryAddress.State || '',
              zip: constituent.PrimaryAddress.PostalCode || ''
            } : null
          } : null,
          customFields: customFields
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
