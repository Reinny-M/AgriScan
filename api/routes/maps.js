const express = require('express');
const router  = express.Router();

// GET /api/maps/config
// Returns the OpenRouteService key for turn-by-turn directions
router.get('/config', (req, res) => {
  res.json({
    key: process.env.ORS_API_KEY || '',  // OpenRouteService — free at openrouteservice.org
    provider: 'openrouteservice'
  });
});

module.exports = router;
