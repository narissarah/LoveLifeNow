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

    // Debug: Return first raw interaction and test constituent access
    if (params.debug === 'true') {
      const firstInteraction = filteredInteractions.length > 0 ? filteredInteractions[0] : null;
      let rawConstituent = null;
      let constituentsList = null;

      // Try to list some constituents to verify API access
      try {
        const listResp = await bloomerangApi.get('/constituents', { params: { take: 3 } });
        constituentsList = listResp.data;
      } catch (e) {
        constituentsList = { error: e.message };
      }

      // If we have an interaction, try to fetch its constituent
      if (firstInteraction && firstInteraction.AccountId) {
        try {
          const constResp = await bloomerangApi.get(`/constituents/${firstInteraction.AccountId}`);
          rawConstituent = constResp.data;
        } catch (e) {
          rawConstituent = { error: e.message, accountId: firstInteraction.AccountId };
        }
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          debug: true,
          rawInteraction: firstInteraction,
          rawConstituent: rawConstituent,
          constituentsList: constituentsList,
          allInteractionKeys: firstInteraction ? Object.keys(firstInteraction) : []
        })
      };
    }

    // Fetch all constituents we need in one request to avoid multiple API calls
    // (Direct constituent lookup by ID returns 404, so we use list with IDs)
    const constituentIds = [...new Set(
      filteredInteractions
        .map(i => i.AccountId)
        .filter(Boolean)
    )];

    let constituentsMap = {};
    if (constituentIds.length > 0) {
      try {
        // Fetch constituents - the list endpoint works when direct lookup doesn't
        const constResponse = await bloomerangApi.get('/constituents', {
          params: { take: 50, id: constituentIds }
        });
        const results = constResponse.data.Results || [];
        results.forEach(c => {
          constituentsMap[c.Id] = c;
        });
      } catch (err) {
        console.log('Constituents fetch error:', err.message);
      }
    }

    // Enrich with constituent details
    const enrichedSubmissions = filteredInteractions.map(interaction => {
      const constituent = constituentsMap[interaction.AccountId] || null;

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
          address: constituent.PrimaryAddress ? {
            street: constituent.PrimaryAddress.Street || '',
            city: constituent.PrimaryAddress.City || '',
            state: constituent.PrimaryAddress.State || '',
            country: constituent.PrimaryAddress.Country || '',
            zip: constituent.PrimaryAddress.PostalCode || ''
          } : null
        } : null,
        customFields: customFields,
        // Also include constituent custom values (age, race, ethnicity, etc.)
        constituentCustomFields: constituent?.CustomValues?.map(cv => ({
          name: cv.FieldText || cv.FieldId,
          value: cv.Value?.Value || cv.Value || ''
        })) || []
      };
    });

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
