const express  = require('express');
const router   = express.Router();
const supabase = require('../supabase');

// POST /api/farmers — Register or find existing farmer
router.post('/', async (req, res) => {
  const { name, phone, location, lat, lon } = req.body;
  if (!name || !phone)
    return res.status(400).json({ success: false, error: 'name and phone required' });

  const cleanPhone = phone.replace(/\s+/g, '').replace(/^0/, '+254');

  try {
    // Check if farmer exists
    const { data: existing } = await supabase
      .from('farmers')
      .select('*')
      .eq('phone', cleanPhone)
      .single();

    if (existing) return res.json({ success: true, farmer: existing, existing: true });

    // Create new farmer
    const { data: farmer, error } = await supabase
      .from('farmers')
      .insert({ name, phone: cleanPhone, location: location || null, lat: lat || null, lon: lon || null })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, farmer, existing: false });
  } catch (err) {
    console.error('Farmer error:', err.message);
    res.status(500).json({ success: false, error: 'Could not register farmer' });
  }
});

// GET /api/farmers/:id
router.get('/:id', async (req, res) => {
  try {
    const { data: farmer, error } = await supabase
      .from('farmers')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !farmer) return res.status(404).json({ success: false, error: 'Farmer not found' });
    res.json({ success: true, farmer });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
