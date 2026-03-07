const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// GET /api/ads/packages — list all ad packages
router.get('/packages', async (req, res) => {
  try {
    const { data, error } = await supabase.from('ad_packages').select('*');
    if (error) throw error;
    res.json({ success: true, packages: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load ad packages' });
  }
});

// POST /api/ads — shop purchases an ad
router.post('/', async (req, res) => {
  const { shop_id, package_id, ad_message, payment_ref, amount_paid } = req.body;
  if (!shop_id || !package_id) return res.status(400).json({ error: 'shop_id and package_id required' });

  try {
    // Get package duration
    const { data: pkg } = await supabase.from('ad_packages').select('*').eq('id', package_id).single();
    if (!pkg) return res.status(404).json({ error: 'Package not found' });

    const now = new Date();
    const expires = new Date();
    expires.setDate(expires.getDate() + pkg.duration_days);

    // Create ad
    const { data: ad, error } = await supabase.from('shop_ads').insert({
      shop_id, package_id,
      ad_message: ad_message || null,
      status: 'active',
      started_at: now.toISOString(),
      expires_at: expires.toISOString(),
      payment_ref: payment_ref || null,
      amount_paid: amount_paid || pkg.price_usd
    }).select().single();

    if (error) throw error;

    // Update shop sponsored status
    await supabase.from('shops').update({
      is_sponsored: true,
      sponsored_until: expires.toISOString(),
      ad_message: ad_message || null,
      ad_package: package_id
    }).eq('id', shop_id);

    // Log payment
    await supabase.from('payments').insert({
      shop_id, type: 'shop_ad',
      amount_usd: amount_paid || pkg.price_usd,
      status: 'completed',
      payment_ref: payment_ref || null
    });

    res.json({ success: true, ad });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to create ad' });
  }
});

// POST /api/ads/:adId/impression — track ad impression
router.post('/:adId/impression', async (req, res) => {
  try {
    await supabase.rpc('increment_ad_impressions', { ad_id: req.params.adId });
    res.json({ success: true });
  } catch {
    res.json({ success: false }); // non-critical
  }
});

module.exports = router;
