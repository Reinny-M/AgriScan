const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// GET /api/crops
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase.from('crops').select('*').order('name');
    if (error) throw error;
    res.json({ success: true, crops: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch crops' });
  }
});

module.exports = router;
