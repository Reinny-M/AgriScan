const express  = require('express');
const router   = express.Router();
const supabase = require('../supabase');

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET /api/shops?lat=&lon=
router.get('/', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat) || null;
    const lon = parseFloat(req.query.lon) || null;

    const { data: shops, error } = await supabase
      .from('shops')
      .select('*')
      .eq('is_active', true)
      .order('is_sponsored', { ascending: false });

    if (error) throw error;

    // Compute distances and sort
    const enriched = shops.map(s => ({
      ...s,
      distance_km: lat && s.lat ? parseFloat(haversineKm(lat, lon, parseFloat(s.lat), parseFloat(s.lon)).toFixed(1)) : null
    }));

    // Sponsored first, then by distance
    enriched.sort((a, b) => {
      if (a.is_sponsored !== b.is_sponsored) return a.is_sponsored ? -1 : 1;
      if (a.distance_km !== null && b.distance_km !== null) return a.distance_km - b.distance_km;
      return 0;
    });

    res.json({ success: true, shops: enriched });
  } catch (err) {
    console.error('Shops error:', err.message);
    res.status(500).json({ success: false, error: 'Could not load shops' });
  }
});

// POST /api/shops — Add new shop (admin / ad signup)
router.post('/', async (req, res) => {
  const { name, address, phone, lat, lon, products, ad_package, ad_message } = req.body;
  if (!name || !address || !lat || !lon)
    return res.status(400).json({ success: false, error: 'name, address, lat, lon required' });

  try {
    const isSponsored = !!ad_package && ad_package !== 'none';
    const sponsoredUntil = isSponsored
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data, error } = await supabase.from('shops').insert({
      name, address, phone: phone || null,
      lat: parseFloat(lat), lon: parseFloat(lon),
      products:        products || [],
      is_sponsored:    isSponsored,
      sponsored_until: sponsoredUntil,
      ad_package:      ad_package || null,
      ad_message:      ad_message || null,
      is_active:       true
    }).select().single();

    if (error) throw error;
    res.json({ success: true, shop: data });
  } catch (err) {
    console.error('Add shop error:', err.message);
    res.status(500).json({ success: false, error: 'Could not add shop' });
  }
});

module.exports = router;
