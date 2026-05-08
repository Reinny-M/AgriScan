const express  = require('express');
const router   = express.Router();
const supabase = require('../supabase');

// POST /api/scans — Save a scan result
router.post('/', async (req, res) => {
  try {
    const { data, error } = await supabase.from('scans').insert(req.body).select().single();
    if (error) throw error;
    res.json({ success: true, scan: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/scans/:farmerId — Get farmer's scan history
router.get('/:farmerId', async (req, res) => {
  try {
    const { data: scans, error } = await supabase
      .from('scans')
      .select('*')
      .eq('farmer_id', req.params.farmerId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json({ success: true, scans: scans || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
