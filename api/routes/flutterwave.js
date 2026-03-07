// ═══════════════════════════════════════════════════
// FLUTTERWAVE PAYMENT INTEGRATION
// Supports: Cards, Mobile Money, Bank Transfer
// Covers: Kenya, Uganda, Tanzania, Ghana, Nigeria + more
// Docs: https://developer.flutterwave.com/
// ═══════════════════════════════════════════════════
const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const crypto  = require('crypto');
const supabase = require('../supabase');

const FLW_BASE    = 'https://api.flutterwave.com/v3';
const FLW_SECRET  = () => process.env.FLUTTERWAVE_SECRET_KEY;
const FLW_PUBLIC  = () => process.env.FLUTTERWAVE_PUBLIC_KEY;

// ── POST /api/flutterwave/initiate ──
// Creates a hosted payment link — user is redirected to Flutterwave checkout
// Body: { amount, currency, email, phone, name, type, plan_id?, shop_id?, farmer_id? }
router.post('/initiate', async (req, res) => {
  const { amount, currency = 'KES', email, phone, name, type, plan_id, shop_id, farmer_id } = req.body;

  if (!amount || !email || !type) {
    return res.status(400).json({ error: 'amount, email, and type are required' });
  }

  const txRef = `agriscan-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  try {
    const payload = {
      tx_ref:           txRef,
      amount:           amount,
      currency:         currency,
      redirect_url:     `${process.env.APP_URL}/api/flutterwave/callback`,
      customer: {
        email,
        phone_number: phone,
        name: name || 'AgriScan Farmer'
      },
      customizations: {
        title:       'AgriScan',
        description: type === 'subscription'
          ? `${plan_id === 'premium' ? 'Premium ($2/mo)' : 'Pro ($5/mo)'} — Plant Disease AI`
          : 'Agro-Vet Shop Advertising',
        logo: `${process.env.APP_URL}/icon-192.png`
      },
      meta: { type, plan_id: plan_id||null, shop_id: shop_id||null, farmer_id: farmer_id||null }
    };

    const flwRes = await axios.post(`${FLW_BASE}/payments`, payload, {
      headers: { Authorization: `Bearer ${FLW_SECRET()}` }
    });

    if (flwRes.data.status !== 'success') {
      return res.status(400).json({ error: flwRes.data.message });
    }

    // Log pending payment
    await supabase.from('payments').insert({
      farmer_id:      farmer_id  || null,
      shop_id:        shop_id    || null,
      type,
      plan_id:        plan_id    || null,
      amount_usd:     type === 'subscription' ? (plan_id === 'pro' ? 5 : 2) : amount,
      currency,
      status:         'pending',
      payment_method: 'flutterwave',
      payment_ref:    txRef
    });

    res.json({
      success:      true,
      payment_link: flwRes.data.data.link,
      tx_ref:       txRef
    });

  } catch (err) {
    console.error('Flutterwave initiate error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Payment initiation failed. Please try again.' });
  }
});

// ── POST /api/flutterwave/mobile-money ──
// Direct mobile money charge (no redirect — better UX for farmers)
// Supports MTN, Airtel, M-Pesa Kenya via Flutterwave
router.post('/mobile-money', async (req, res) => {
  const { phone, amount, currency = 'KES', network = 'MPESA', email, name, type, plan_id, shop_id, farmer_id } = req.body;

  if (!phone || !amount || !email) {
    return res.status(400).json({ error: 'phone, amount, and email are required' });
  }

  const txRef = `agriscan-mm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const networkRoutes = {
    KES:  { MPESA: 'mpesa', AIRTEL: 'ke-airtel' },
    UGX:  { MTN: 'mtn-ug', AIRTEL: 'airtel-ug' },
    GHS:  { MTN: 'mtn-gh', VODAFONE: 'vodafone-gh' },
    TZS:  { MPESA: 'mpesa-tz', AIRTEL: 'airtel-tz' },
    NGN:  { MPESA: 'mpesa' }
  };

  try {
    const flwRes = await axios.post(`${FLW_BASE}/charges?type=mobile_money_${currency.toLowerCase()}`, {
      tx_ref:  txRef,
      amount,
      currency,
      phone_number: phone,
      email,
      fullname: name || 'AgriScan Farmer',
      network:  networkRoutes[currency]?.[network] || 'mpesa',
      meta:     { type, plan_id, shop_id, farmer_id }
    }, {
      headers: { Authorization: `Bearer ${FLW_SECRET()}` }
    });

    // Log pending
    await supabase.from('payments').insert({
      farmer_id, shop_id, type, plan_id,
      amount_usd:     type === 'subscription' ? (plan_id === 'pro' ? 5 : 2) : parseFloat(amount),
      currency,
      status:         'pending',
      payment_method: `flutterwave_${network.toLowerCase()}`,
      payment_ref:    txRef
    });

    res.json({
      success:   true,
      tx_ref:    txRef,
      status:    flwRes.data.status,
      message:   '📱 Check your phone and approve the mobile money payment.',
      flw_data:  flwRes.data.data
    });

  } catch (err) {
    console.error('Flutterwave mobile money error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Mobile money charge failed. Check phone number and try again.' });
  }
});

// ── GET /api/flutterwave/callback ──
// Flutterwave redirects here after hosted checkout
router.get('/callback', async (req, res) => {
  const { tx_ref, status, transaction_id } = req.query;

  if (status !== 'successful') {
    await supabase.from('payments').update({ status: 'failed' }).eq('payment_ref', tx_ref);
    return res.redirect(`${process.env.APP_URL}?payment=failed`);
  }

  try {
    // Verify transaction with Flutterwave
    const verify = await axios.get(`${FLW_BASE}/transactions/${transaction_id}/verify`, {
      headers: { Authorization: `Bearer ${FLW_SECRET()}` }
    });

    const txData = verify.data.data;
    if (txData.status !== 'successful') {
      await supabase.from('payments').update({ status: 'failed' }).eq('payment_ref', tx_ref);
      return res.redirect(`${process.env.APP_URL}?payment=failed`);
    }

    await activatePayment(tx_ref, transaction_id.toString(), txData.meta);
    res.redirect(`${process.env.APP_URL}?payment=success&plan=${txData.meta?.plan_id || ''}`);

  } catch (err) {
    console.error('Callback verify error:', err.message);
    res.redirect(`${process.env.APP_URL}?payment=error`);
  }
});

// ── POST /api/flutterwave/webhook ──
// Real-time webhook for mobile money completions
router.post('/webhook', async (req, res) => {
  // Verify webhook signature
  const hash = crypto
    .createHmac('sha256', process.env.FLUTTERWAVE_WEBHOOK_SECRET || '')
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (req.headers['verif-hash'] !== process.env.FLUTTERWAVE_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { event, data } = req.body;
  if (event === 'charge.completed' && data.status === 'successful') {
    await activatePayment(data.tx_ref, data.id.toString(), data.meta);
  }

  res.json({ status: 'ok' });
});

// ── GET /api/flutterwave/status/:txRef ──
// Poll payment status
router.get('/status/:txRef', async (req, res) => {
  try {
    const { data: payment } = await supabase
      .from('payments')
      .select('status, type, plan_id')
      .eq('payment_ref', req.params.txRef)
      .single();

    res.json({ success: true, status: payment?.status || 'pending', payment });
  } catch {
    res.json({ success: false, status: 'unknown' });
  }
});

// ── HELPER: activate subscription or shop ad after payment ──
async function activatePayment(txRef, paymentRef, meta) {
  const { data: payment } = await supabase
    .from('payments')
    .select('*')
    .eq('payment_ref', txRef)
    .single();

  if (!payment || payment.status === 'completed') return;

  await supabase.from('payments').update({ status: 'completed', payment_ref: paymentRef }).eq('id', payment.id);

  if (payment.type === 'subscription' && (payment.farmer_id || meta?.farmer_id)) {
    const farmerId = payment.farmer_id || meta.farmer_id;
    const planId   = payment.plan_id   || meta?.plan_id || 'premium';
    const expires  = new Date(); expires.setDate(expires.getDate() + 30);

    // Cancel existing
    await supabase.from('subscriptions').update({ status: 'cancelled' })
      .eq('farmer_id', farmerId).eq('status', 'active');

    await supabase.from('subscriptions').insert({
      farmer_id:   farmerId,
      plan_id:     planId,
      status:      'active',
      expires_at:  expires.toISOString(),
      payment_ref: paymentRef,
      amount_paid: payment.amount_usd
    });
  }

  if (payment.type === 'shop_ad' && (payment.shop_id || meta?.shop_id)) {
    const shopId  = payment.shop_id || meta.shop_id;
    const expires = new Date(); expires.setDate(expires.getDate() + 30);
    await supabase.from('shops').update({
      is_sponsored:    true,
      sponsored_until: expires.toISOString()
    }).eq('id', shopId);
  }
}

module.exports = router;
