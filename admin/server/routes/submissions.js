const express = require('express');
const axios = require('axios');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// Bloomerang API configuration
const BLOOMERANG_API_BASE = 'https://api.bloomerang.co/v2';

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
  baseURL: BLOOMERANG_API_BASE,
  headers: {
    'X-API-Key': process.env.BLOOMERANG_API_KEY,
    'Content-Type': 'application/json'
  }
});

/**
 * GET /api/submissions/:formType
 * Fetch submissions for a specific form type
 */
router.get('/:formType', requireAuth, async (req, res) => {
  const { formType } = req.params;
  const { take = 50, skip = 0 } = req.query;

  const channelId = FORM_CHANNELS[formType];
  if (!channelId) {
    return res.status(400).json({
      error: 'Invalid form type',
      validTypes: Object.keys(FORM_CHANNELS)
    });
  }

  try {
    // Fetch interactions filtered by channel
    const response = await bloomerangApi.get('/interactions', {
      params: {
        take: parseInt(take),
        skip: parseInt(skip),
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

    res.json({
      formType,
      total: response.data.Total || enrichedSubmissions.length,
      submissions: enrichedSubmissions
    });

  } catch (error) {
    console.error('Bloomerang API error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to fetch submissions',
      details: error.response?.data?.Message || error.message
    });
  }
});

/**
 * GET /api/submissions/:formType/:id
 * Fetch a single submission by ID
 */
router.get('/:formType/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const response = await bloomerangApi.get(`/interactions/${id}`);
    const interaction = response.data;

    let constituent = null;
    if (interaction.AccountId) {
      try {
        const constResponse = await bloomerangApi.get(`/constituents/${interaction.AccountId}`);
        constituent = constResponse.data;
      } catch (err) {
        console.error(`Failed to fetch constituent:`, err.message);
      }
    }

    res.json({
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
    });

  } catch (error) {
    console.error('Bloomerang API error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to fetch submission',
      details: error.response?.data?.Message || error.message
    });
  }
});

module.exports = router;
