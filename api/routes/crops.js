const express  = require('express');
const router   = express.Router();
const supabase = require('../supabase');

// GET /api/crops
router.get('/', async (req, res) => {
  try {
    const { data: crops, error } = await supabase
      .from('crops')
      .select('*')
      .order('name');

    if (error) throw error;
    res.json({ success: true, crops });
  } catch (err) {
    console.error('Crops error:', err.message);
    res.status(500).json({ success: false, error: 'Could not load crops' });
  }
});

module.exports = router;
