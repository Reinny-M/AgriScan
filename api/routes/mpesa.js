const express = require('express');
const router  = express.Router();
const axios   = require('axios');

const MPESA_BASE = process.env.MPESA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

async function getMpesaToken() {
  const key    = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  const creds  = Buffer.from(`${key}:${secret}`).toString('base64');
  const res = await axios.get(`${MPESA_BASE}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${creds}` }
  });
  return res.data.access_token;
}

function formatPhone(phone) {
  let p = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  if (p.startsWith('0')) p = '254' + p.slice(1);
  if (p.startsWith('+')) p = p.slice(1);
  return p;
}

function getTimestamp() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth()+1).padStart(2,'0'),
    String(d.getDate()).padStart(2,'0'),
    String(d.getHours()).padStart(2,'0'),
    String(d.getMinutes()).padStart(2,'0'),
    String(d.getSeconds()).padStart(2,'0')
  ].join('');
}

// POST /api/mpesa/stk-push
router.post('/stk-push', async (req, res) => {
  const { phone, amount, type, plan_id, farmer_id } = req.body;
  if (!phone || !amount) return res.status(400).json({ success:false, error:'phone and amount required' });

  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey   = process.env.MPESA_PASSKEY;
  const callbackUrl = process.env.MPESA_CALLBACK_URL || 'https://agriscan.vercel.app/api/mpesa/callback';

  try {
    const token     = await getMpesaToken();
    const timestamp = getTimestamp();
    const password  = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    const stkRes = await axios.post(`${MPESA_BASE}/mpesa/stkpush/v1/processrequest`, {
      BusinessShortCode: shortcode,
      Password:          password,
      Timestamp:         timestamp,
      TransactionType:   'CustomerPayBillOnline',
      Amount:            Math.round(amount * 135), // USD → KES approx
      PartyA:            formatPhone(phone),
      PartyB:            shortcode,
      PhoneNumber:       formatPhone(phone),
      CallBackURL:       callbackUrl,
      AccountReference:  `AgriScan-${plan_id || type || 'payment'}`,
      TransactionDesc:   `AgriScan ${plan_id || 'payment'}`
    }, { headers: { Authorization: `Bearer ${token}` } });

    const checkoutId = stkRes.data.CheckoutRequestID;

    // Store pending transaction in memory (use Supabase in production)
    global.pendingMpesa = global.pendingMpesa || {};
    global.pendingMpesa[checkoutId] = { status:'pending', type, plan_id, farmer_id, amount };

    res.json({ success: true, checkout_request_id: checkoutId, message: 'STK push sent. Enter PIN on your phone.' });
  } catch (err) {
    console.error('M-Pesa error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'M-Pesa request failed. Check your Daraja credentials.' });
  }
});

// GET /api/mpesa/status/:checkoutId
router.get('/status/:checkoutId', async (req, res) => {
  const pending = global.pendingMpesa?.[req.params.checkoutId];
  if (!pending) return res.json({ status: 'pending' });
  res.json({ status: pending.status, payment: pending });
});

// POST /api/mpesa/callback — Daraja calls this after payment
router.post('/callback', (req, res) => {
  const body = req.body?.Body?.stkCallback;
  if (!body) return res.json({ ResultCode: 0, ResultDesc: 'OK' });

  const id     = body.CheckoutRequestID;
  const code   = body.ResultCode;
  global.pendingMpesa = global.pendingMpesa || {};

  if (global.pendingMpesa[id]) {
    global.pendingMpesa[id].status = code === 0 ? 'completed' : 'failed';
  }

  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

module.exports = router;
