const express = require('express');
const router  = express.Router();
const axios   = require('axios');

const WEATHER_ICONS = {
  Clear: '☀️', Clouds: '⛅', Rain: '🌧️', Drizzle: '🌦️',
  Thunderstorm: '⛈️', Snow: '❄️', Mist: '🌫️', Fog: '🌫️',
  Haze: '🌫️', Smoke: '🌫️', Dust: '💨', Sand: '💨',
  Ash: '🌋', Squall: '💨', Tornado: '🌪️'
};

function weatherIcon(main) { return WEATHER_ICONS[main] || '🌤️'; }

function cropAlerts(weather, humidity, windSpeed, rainChance) {
  const alerts = [];
  const temp = weather.main.temp;
  const main = weather.weather[0].main;

  if (main === 'Rain' || rainChance > 70)
    alerts.push({ type:'danger', icon:'⚠️', title:'High Disease Risk', desc:'Wet conditions favor fungal diseases. Apply preventive fungicide before rain.' });
  if (humidity > 80)
    alerts.push({ type:'warning', icon:'💧', title:'High Humidity Alert', desc:'Humidity above 80% — ideal for blight and mold. Improve air circulation.' });
  if (temp > 35)
    alerts.push({ type:'warning', icon:'🌡️', title:'Heat Stress Risk', desc:'Temperatures above 35°C stress crops. Water in early morning and evening.' });
  if (temp < 10)
    alerts.push({ type:'warning', icon:'🥶', title:'Cold Risk', desc:'Low temperatures can damage seedlings. Consider frost protection.' });
  if (windSpeed > 40)
    alerts.push({ type:'danger', icon:'💨', title:'Strong Winds', desc:'High winds can damage crops and spread disease spores. Stake tall plants.' });
  if (alerts.length === 0)
    alerts.push({ type:'info', icon:'✅', title:'Conditions Favorable', desc:'Weather looks good for crops. Keep scouting your fields as usual.' });

  return alerts;
}

// GET /api/weather?lat=&lon=
router.get('/', async (req, res) => {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return res.status(500).json({ success: false, error: 'OpenWeather API key not configured' });

  const lat = parseFloat(req.query.lat) || -0.303099; // default Nakuru
  const lon = parseFloat(req.query.lon) || 36.080026;

  try {
    const [currentRes, forecastRes] = await Promise.all([
      axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`),
      axios.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&cnt=56`)
    ]);

    const cw = currentRes.data;
    const fw = forecastRes.data;

    // Current weather
    const current = {
      temp:        Math.round(cw.main.temp),
      feels_like:  Math.round(cw.main.feels_like),
      humidity:    cw.main.humidity,
      wind_speed:  Math.round(cw.wind.speed * 3.6), // m/s → km/h
      description: cw.weather[0].description.charAt(0).toUpperCase() + cw.weather[0].description.slice(1),
      icon:        weatherIcon(cw.weather[0].main),
      city:        cw.name,
      rain_chance: cw.rain ? 80 : 0
    };

    // 7-day forecast (one entry per day from 3h intervals)
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const dailyMap = {};
    fw.list.forEach(item => {
      const date = item.dt_txt.split(' ')[0];
      if (!dailyMap[date]) dailyMap[date] = { temps: [], rains: [], main: item.weather[0].main, day: days[new Date(date).getDay()] };
      dailyMap[date].temps.push(item.main.temp);
      dailyMap[date].rains.push(item.pop * 100);
    });

    const forecast = Object.values(dailyMap).slice(0, 7).map(d => ({
      day:         d.day,
      temp:        Math.round(d.temps.reduce((a,b)=>a+b,0)/d.temps.length),
      rain_chance: Math.round(Math.max(...d.rains)),
      icon:        weatherIcon(d.main)
    }));

    const alerts = cropAlerts(cw, cw.main.humidity, cw.wind.speed * 3.6, cw.rain ? 80 : 0);

    res.json({ success: true, current, forecast, alerts });
  } catch (err) {
    console.error('Weather error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Weather fetch failed' });
  }
});

module.exports = router;
