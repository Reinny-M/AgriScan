const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// GET /api/subscriptions/plans — list all plans
router.get('/plans', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('subscription_plans').select('*').eq('is_active', true);
    if (error) throw error;
    res.json({ success: true, plans: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load plans' });
  }
});

// GET /api/subscriptions/:farmerId — get farmer's current subscription
router.get('/:farmerId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*, subscription_plans(*)')
      .eq('farmer_id', req.params.farmerId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    res.json({ success: true, subscription: data || null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// POST /api/subscriptions — create/upgrade subscription
router.post('/', async (req, res) => {
  const { farmer_id, plan_id, payment_ref, amount_paid } = req.body;
  if (!farmer_id || !plan_id) return res.status(400).json({ error: 'farmer_id and plan_id required' });

  try {
    // Cancel any existing active subscription
    await supabase.from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('farmer_id', farmer_id)
      .eq('status', 'active');

    const expires = new Date();
    expires.setDate(expires.getDate() + 30);

    const { data, error } = await supabase.from('subscriptions').insert({
      farmer_id, plan_id,
      status: 'active',
      expires_at: expires.toISOString(),
      payment_ref: payment_ref || null,
      amount_paid: amount_paid || 0
    }).select('*, subscription_plans(*)').single();

    if (error) throw error;

    // Log payment
    if (amount_paid > 0) {
      await supabase.from('payments').insert({
        farmer_id, type: 'subscription', plan_id,
        amount_usd: amount_paid, status: 'completed',
        payment_ref: payment_ref || null
      });
    }

    res.json({ success: true, subscription: data });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

module.exports = router;
