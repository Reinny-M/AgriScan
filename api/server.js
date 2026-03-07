require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, '../frontend/public')));

// ── ROUTES ──
app.use('/api/analyze',       require('./routes/analyze'));
app.use('/api/weather',       require('./routes/weather'));
app.use('/api/shops',         require('./routes/shops'));
app.use('/api/crops',         require('./routes/crops'));
app.use('/api/scans',         require('./routes/scans'));
app.use('/api/farmers',       require('./routes/farmers'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/ads',           require('./routes/ads'));
app.use('/api/mpesa',         require('./routes/mpesa'));
app.use('/api/flutterwave',   require('./routes/flutterwave'));
app.use('/api/maps',          require('./routes/maps'));

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ AgriScan running on http://localhost:${PORT}`));

module.exports = app;
