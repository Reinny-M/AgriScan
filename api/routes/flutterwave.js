const express = require('express');
const router  = express.Router();
const axios   = require('axios');

// POST /api/flutterwave/initiate
router.post('/initiate', async (req, res) => {
  const { amount, currency, email, phone, name, type, plan_id, farmer_id } = req.body;
  if (!amount || !email) return res.status(400).json({ success:false, error:'amount and email required' });

  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ success:false, error:'Flutterwave key not configured' });

  const txRef = `agriscan-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const redirectUrl = process.env.FLUTTERWAVE_REDIRECT_URL || 'https://agriscan.vercel.app/?payment=success';

  try {
    const flwRes = await axios.post('https://api.flutterwave.com/v3/payments', {
      tx_ref:       txRef,
      amount:       amount * 135,  // USD → KES approx
      currency:     currency || 'KES',
      redirect_url: redirectUrl,
      customer: { email, phone_number: phone || '', name: name || 'AgriScan Farmer' },
      customizations: {
        title:       'AgriScan',
        description: `${plan_id || type || 'AgriScan'} payment`,
        logo:        'https://agriscan.vercel.app/icon-192.png'
      },
      meta: { type, plan_id, farmer_id, tx_ref }
    }, { headers: { Authorization: `Bearer ${secretKey}` } });

    if (flwRes.data.status !== 'success') throw new Error(flwRes.data.message);
    res.json({ success: true, payment_link: flwRes.data.data.link, tx_ref: txRef });
  } catch (err) {
    console.error('Flutterwave error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Payment initiation failed' });
  }
});

// GET /api/flutterwave/verify/:txRef
router.get('/verify/:txRef', async (req, res) => {
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  try {
    const flwRes = await axios.get(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${req.params.txRef}`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    );
    const d = flwRes.data?.data;
    if (d?.status === 'successful') {
      res.json({ success: true, status: 'completed', payment: d });
    } else {
      res.json({ success: false, status: d?.status || 'pending' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

module.exports = router;
