// ═══════════════════════════════════════════════
// MAPS CONFIG ROUTE
// Returns the OpenRouteService key to the frontend
// ORS is 100% free — no credit card needed
// Sign up at: https://openrouteservice.org/dev/#/signup
// ═══════════════════════════════════════════════
const express = require('express');
const router  = express.Router();

// GET /api/maps/config
router.get('/config', (req, res) => {
  res.json({
    key:      process.env.ORS_API_KEY || '',
    provider: 'openrouteservice'
  });
});

module.exports = router;
