const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// POST /api/farmers — register a farmer
router.post('/', async (req, res) => {
  const { name, phone, location, lat, lon } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'name and phone are required' });

  try {
    // Check if farmer already exists
    const { data: existing } = await supabase
      .from('farmers').select('*').eq('phone', phone).single();

    if (existing) return res.json({ success: true, farmer: existing, existing: true });

    const { data, error } = await supabase
      .from('farmers').insert({ name, phone, location, lat, lon }).select().single();

    if (error) throw error;
    res.json({ success: true, farmer: data, existing: false });
  } catch (err) {
    res.status(500).json({ error: 'Failed to register farmer' });
  }
});

// GET /api/farmers/:id
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('farmers').select('*').eq('id', req.params.id).single();
    if (error) throw error;
    res.json({ success: true, farmer: data });
  } catch (err) {
    res.status(500).json({ error: 'Farmer not found' });
  }
});

module.exports = router;
