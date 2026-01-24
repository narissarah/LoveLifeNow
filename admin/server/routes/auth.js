const express = require('express');
const router = express.Router();

/**
 * POST /api/auth/login
 * Authenticate with admin password
 */
router.post('/login', (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  if (password === process.env.ADMIN_PASSWORD) {
    req.session.authenticated = true;
    res.json({ success: true, message: 'Login successful' });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

/**
 * POST /api/auth/logout
 * Clear the session
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true, message: 'Logged out' });
  });
});

/**
 * GET /api/auth/check
 * Check if user is authenticated
 */
router.get('/check', (req, res) => {
  res.json({ authenticated: !!req.session.authenticated });
});

module.exports = router;
