// ═══════════════════════════════════════════════════
// M-PESA DARAJA API — Safaricom STK Push Integration
// Docs: https://developer.safaricom.co.ke/
// ═══════════════════════════════════════════════════
const express = require('express');
const router = express.Router();
const axios = require('axios');
const supabase = require('../supabase');

const MPESA_BASE = process.env.MPESA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

// ── STEP 1: Get OAuth token from Safaricom ──
async function getMpesaToken() {
  const key    = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  const auth   = Buffer.from(`${key}:${secret}`).toString('base64');

  const res = await axios.get(
    `${MPESA_BASE}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  );
  return res.data.access_token;
}

// ── STEP 2: Build password for STK Push ──
function getMpesaPassword() {
  const shortcode  = process.env.MPESA_SHORTCODE;
  const passkey    = process.env.MPESA_PASSKEY;
  const timestamp  = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const password   = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
  return { password, timestamp };
}

// ── POST /api/mpesa/stk-push ──
// Initiates STK Push — sends payment prompt to farmer's phone
// Body: { phone, amount, type: 'subscription'|'shop_ad', plan_id?, shop_id?, farmer_id? }
router.post('/stk-push', async (req, res) => {
  const { phone, amount, type, plan_id, shop_id, farmer_id, description } = req.body;

  if (!phone || !amount || !type) {
    return res.status(400).json({ error: 'phone, amount, and type are required' });
  }

  // Normalize phone: strip leading 0 or +254, add 254
  const normalizedPhone = phone.replace(/^(\+254|0)/, '254');

  try {
    const token = await getMpesaToken();
    const { password, timestamp } = getMpesaPassword();
    const shortcode = process.env.MPESA_SHORTCODE;
    const callbackUrl = `${process.env.APP_URL}/api/mpesa/callback`;

    const stkRes = await axios.post(
      `${MPESA_BASE}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.ceil(amount * 130), // Convert USD to KES (approx rate)
        PartyA: normalizedPhone,
        PartyB: shortcode,
        PhoneNumber: normalizedPhone,
        CallBackURL: callbackUrl,
        AccountReference: `AgriScan-${type === 'subscription' ? plan_id : 'ShopAd'}`,
        TransactionDesc: description || `AgriScan ${type}`
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const { CheckoutRequestID, ResponseCode, ResponseDescription } = stkRes.data;

    if (ResponseCode !== '0') {
      return res.status(400).json({ error: ResponseDescription });
    }

    // Save pending payment to DB
    await supabase.from('payments').insert({
      farmer_id:   farmer_id  || null,
      shop_id:     shop_id    || null,
      type,
      plan_id:     plan_id    || null,
      amount_usd:  amount,
      currency:    'KES',
      status:      'pending',
      payment_method: 'mpesa',
      payment_ref: CheckoutRequestID
    });

    res.json({
      success: true,
      checkout_request_id: CheckoutRequestID,
      message: '📱 STK Push sent! Check your phone and enter M-Pesa PIN.'
    });

  } catch (err) {
    console.error('M-Pesa STK error:', err.response?.data || err.message);
    res.status(500).json({ error: 'M-Pesa request failed. Please try again.' });
  }
});

// ── POST /api/mpesa/callback ──
// Safaricom sends payment result here
router.post('/callback', async (req, res) => {
  const body = req.body?.Body?.stkCallback;
  if (!body) return res.json({ ResultCode: 0 });

  const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = body;

  if (ResultCode === 0) {
    // Payment successful
    const meta = {};
    CallbackMetadata?.Item?.forEach(item => { meta[item.Name] = item.Value; });

    // Find pending payment
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('payment_ref', CheckoutRequestID)
      .eq('status', 'pending')
      .single();

    if (payment) {
      // Mark payment as completed
      await supabase.from('payments').update({
        status: 'completed',
        payment_ref: meta.MpesaReceiptNumber || CheckoutRequestID
      }).eq('id', payment.id);

      // Activate what was paid for
      if (payment.type === 'subscription' && payment.farmer_id) {
        const expires = new Date();
        expires.setDate(expires.getDate() + 30);
        await supabase.from('subscriptions').insert({
          farmer_id:  payment.farmer_id,
          plan_id:    payment.plan_id,
          status:     'active',
          expires_at: expires.toISOString(),
          payment_ref: meta.MpesaReceiptNumber,
          amount_paid: payment.amount_usd
        });
      }

      if (payment.type === 'shop_ad' && payment.shop_id) {
        const expires = new Date();
        expires.setDate(expires.getDate() + 30);
        await supabase.from('shops').update({
          is_sponsored:    true,
          sponsored_until: expires.toISOString()
        }).eq('id', payment.shop_id);
      }
    }
  } else {
    // Payment failed or cancelled
    await supabase.from('payments').update({ status: 'failed' })
      .eq('payment_ref', CheckoutRequestID);
  }

  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// ── GET /api/mpesa/status/:checkoutId ──
// Poll payment status (frontend polls this every 3s)
router.get('/status/:checkoutId', async (req, res) => {
  try {
    const { data: payment } = await supabase
      .from('payments')
      .select('status, type, plan_id')
      .eq('payment_ref', req.params.checkoutId)
      .single();

    res.json({ success: true, status: payment?.status || 'pending', payment });
  } catch {
    res.json({ success: false, status: 'unknown' });
  }
});

module.exports = router;
