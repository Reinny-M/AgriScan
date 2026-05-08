const express  = require('express');
const router   = express.Router();
const axios    = require('axios');
const supabase = require('../supabase');

// POST /api/analyze
router.post('/', async (req, res) => {
  const { image_base64, mime_type, farmer_id, location, lat, lon } = req.body;

  if (!image_base64 || !mime_type)
    return res.status(400).json({ success: false, error: 'image_base64 and mime_type are required' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey)
    return res.status(500).json({ success: false, error: 'Groq API key not configured' });

  const prompt = `You are an expert plant pathologist AI for African farmers. Analyze this plant leaf image and respond ONLY with valid JSON — no markdown, no extra text:
{
  "disease_name": "Name of disease or 'Healthy Plant'",
  "crop_type": "Detected crop e.g. Tomato, Maize, Potato, Bean, Rice, or Unknown",
  "severity": "low|medium|high|none",
  "severity_percent": 0,
  "cause": "Brief cause (1-2 sentences)",
  "symptoms": "Visible symptoms present",
  "treatment": ["step 1", "step 2", "step 3"],
  "prevention": ["tip 1", "tip 2", "tip 3"],
  "urgency": "Act within X days or No action needed",
  "is_healthy": false
}
Be specific and practical for small-scale African farmers. If not a plant image, set disease_name to "Not a plant image".`;

  try {
    const groqRes = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mime_type};base64,${image_base64}` } },
            { type: 'text', text: prompt }
          ]
        }],
        temperature: 0.2,
        max_tokens: 1024
      },
      { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
    );

    const rawText = groqRes.data.choices[0].message.content;
    const clean   = rawText.replace(/```json|```/g, '').trim();
    const result  = JSON.parse(clean);
    result.is_healthy = result.disease_name === 'Healthy Plant';

    // Save to Supabase
    if (farmer_id) {
      await supabase.from('scans').insert({
        farmer_id,
        disease_name:     result.disease_name,
        crop_type:        result.crop_type,
        severity:         result.severity,
        severity_percent: result.severity_percent,
        cause:            result.cause,
        symptoms:         result.symptoms,
        treatment:        result.treatment,
        prevention:       result.prevention,
        urgency:          result.urgency,
        is_healthy:       result.is_healthy,
        location:         location || null,
        lat:              lat || null,
        lon:              lon || null
      });
    }

    res.json({ success: true, result });
  } catch (err) {
    console.error('Groq error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'AI analysis failed. Check your Groq API key.' });
  }
});

module.exports = router;
