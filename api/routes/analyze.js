const express = require('express');
const router = express.Router();
const axios = require('axios');
const supabase = require('../supabase');

// POST /api/analyze
// Body: { image_base64, mime_type, farmer_id?, location?, lat?, lon? }
router.post('/', async (req, res) => {
  const { image_base64, mime_type, farmer_id, location, lat, lon } = req.body;

  if (!image_base64 || !mime_type) {
    return res.status(400).json({ error: 'image_base64 and mime_type are required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Gemini API key not configured on server' });

  const prompt = `You are an expert plant pathologist AI for African farmers. Analyze this plant leaf image and respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{
  "disease_name": "Name of disease or 'Healthy Plant'",
  "crop_type": "Detected crop type e.g. Tomato, Maize, Potato, Bean, Rice, or Unknown",
  "severity": "low|medium|high|none",
  "severity_percent": 0,
  "cause": "Brief cause explanation (1-2 sentences)",
  "symptoms": "What visible symptoms are present",
  "treatment": ["step 1", "step 2", "step 3"],
  "prevention": ["tip 1", "tip 2", "tip 3"],
  "urgency": "Act within X days or No action needed",
  "is_healthy": false
}
Be specific and practical for small-scale African farmers. If the image is not a plant, set disease_name to "Not a plant image".`;

  try {
    const geminiRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type, data: image_base64 } }
          ]
        }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 }
      }
    );

    const rawText = geminiRes.data.candidates[0].content.parts[0].text;
    const clean = rawText.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    result.is_healthy = result.disease_name === 'Healthy Plant';

    // Save scan to Supabase if farmer_id provided
    if (farmer_id) {
      await supabase.from('scans').insert({
        farmer_id,
        disease_name: result.disease_name,
        crop_type: result.crop_type,
        severity: result.severity,
        severity_percent: result.severity_percent,
        cause: result.cause,
        symptoms: result.symptoms,
        treatment: result.treatment,
        prevention: result.prevention,
        urgency: result.urgency,
        is_healthy: result.is_healthy,
        location: location || null,
        lat: lat || null,
        lon: lon || null
      });
    }

    res.json({ success: true, result });

  } catch (err) {
    console.error('Gemini error:', err.response?.data || err.message);
    res.status(500).json({ error: 'AI analysis failed. Check your API key and try again.' });
  }
});

module.exports = router;
