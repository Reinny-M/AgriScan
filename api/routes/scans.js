const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// GET /api/scans/:farmerId — scan history for a farmer
router.get('/:farmerId', async (req, res) => {
  const { farmerId } = req.params;
  try {
    const { data, error } = await supabase
      .from('scans')
      .select('*')
      .eq('farmer_id', farmerId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json({ success: true, scans: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch scans' });
  }
});

// POST /api/scans — save a scan manually
router.post('/', async (req, res) => {
  try {
    const { data, error } = await supabase.from('scans').insert(req.body).select().single();
    if (error) throw error;
    res.json({ success: true, scan: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save scan' });
  }
});

module.exports = router;
