const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// GET /api/shops?lat=&lon=&radius=20
router.get('/', async (req, res) => {
  const { lat, lon, radius = 20 } = req.query;

  try {
    const { data: shops, error } = await supabase
      .from('shops')
      .select('*')
      .eq('is_active', true)
      .order('is_sponsored', { ascending: false });

    if (error) throw error;

    // Calculate distance if coordinates provided
    let results = shops;
    if (lat && lon) {
      results = shops
        .map(shop => ({
          ...shop,
          distance_km: haversine(parseFloat(lat), parseFloat(lon), shop.lat, shop.lon)
        }))
        .filter(s => s.distance_km <= parseFloat(radius))
        .sort((a, b) => {
          // Sponsored first, then by distance
          if (a.is_sponsored !== b.is_sponsored) return b.is_sponsored - a.is_sponsored;
          return a.distance_km - b.distance_km;
        });
    }

    res.json({ success: true, shops: results });
  } catch (err) {
    console.error('Shops error:', err.message);
    res.status(500).json({ error: 'Failed to fetch shops' });
  }
});

// POST /api/shops — Add a new shop
router.post('/', async (req, res) => {
  const { name, address, phone, lat, lon, products, is_sponsored, sponsored_until } = req.body;

  if (!name || !address || !lat || !lon) {
    return res.status(400).json({ error: 'name, address, lat, lon are required' });
  }

  try {
    const { data, error } = await supabase.from('shops').insert({
      name, address, phone, lat, lon,
      products: products || [],
      is_sponsored: is_sponsored || false,
      sponsored_until: sponsored_until || null
    }).select().single();

    if (error) throw error;
    res.json({ success: true, shop: data });
  } catch (err) {
    console.error('Add shop error:', err.message);
    res.status(500).json({ error: 'Failed to add shop' });
  }
});

// Haversine formula — distance between two GPS coordinates in km
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return +(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(1);
}
function toRad(deg) { return deg * Math.PI / 180; }

module.exports = router;
