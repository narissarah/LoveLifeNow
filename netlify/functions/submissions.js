const axios = require('axios');
const { verifyAuth, unauthorizedResponse } = require('./utils/auth');
const { getPool, initDb } = require('./utils/db');

// Form type to Subject pattern mapping
const FORM_SUBJECTS = {
  contact: 'Contact Form',
  volunteer: 'Volunteer',
  speaker: 'Book A Speaker',
  getsafe: 'GetSafeApplication',
  donate: 'Donation',
  newsletter: 'Newsletter'
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

  // Parse query parameters
  const params = event.queryStringParameters || {};
  const formType = params.type;
  const searchTerm = (params.search || '').trim().toLowerCase();
  const includeDeleted = params.includeDeleted === 'true';

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

        // Build constituent name with fallback to interaction AccountName
        const constituentName = constituent
          ? `${constituent.FirstName || ''} ${constituent.LastName || ''}`.trim()
          : null;
        const fallbackName = interaction.AccountName || null;

      return {
        id: interaction.Id,
        date: interaction.Date,
        subject: interaction.Subject || 'No Subject',
        note: message,
        constituent: {
          id: constituent?.Id || interaction.AccountId || null,
          name: constituentName || fallbackName || null,
          email: constituent?.PrimaryEmail?.Value || null,
          phone: constituent?.PrimaryPhone?.Number || null,
          address: constituent?.PrimaryAddress ? {
            street: constituent.PrimaryAddress.Street || '',
            city: constituent.PrimaryAddress.City || '',
            state: constituent.PrimaryAddress.State || '',
            country: constituent.PrimaryAddress.Country || '',
            zip: constituent.PrimaryAddress.PostalCode || ''
          } : null
        },
        customFields: customFields,
        // Also include constituent custom values (age, race, ethnicity, etc.)
        constituentCustomFields: constituent?.CustomValues?.map(cv => ({
          name: cv.FieldText || cv.FieldId,
          value: cv.Value?.Value || cv.Value || ''
        })) || []
      };
    });

    // Fetch DB statuses and merge
    let statusMap = {};
    try {
      await initDb();
      const sql = getPool();
      const rows = await sql`
        SELECT submission_id, is_read, is_archived, is_deleted, notes
        FROM submission_status
        WHERE form_type = ${formType}
      `;
      rows.forEach(r => {
        statusMap[r.submission_id] = {
          read: r.is_read,
          archived: r.is_archived,
          deleted: r.is_deleted,
          notes: r.notes || ''
        };
      });
    } catch (dbErr) {
      console.log('DB status fetch error (continuing without):', dbErr.message);
    }

    // Merge status into each submission
    let results = enrichedSubmissions.map(sub => ({
      ...sub,
      status: statusMap[String(sub.id)] || { read: false, archived: false, deleted: false, notes: '' }
    }));

    // Filter out soft-deleted unless requested
    if (!includeDeleted) {
      results = results.filter(sub => !sub.status.deleted);
    }

    // Search filter (case-insensitive on name and email)
    if (searchTerm) {
      results = results.filter(sub => {
        const name = (sub.constituent?.name || '').toLowerCase();
        const email = (sub.constituent?.email || '').toLowerCase();
        return name.includes(searchTerm) || email.includes(searchTerm);
      });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formType,
        total: results.length,
        submissions: results
      })
    };

  } catch (error) {
    console.error('Bloomerang API error:', error.response?.data || error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to fetch submissions'
      })
    };
  }
};
