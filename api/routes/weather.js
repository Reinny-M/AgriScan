const express = require('express');
const router = express.Router();
const axios = require('axios');

// GET /api/weather?lat=&lon=
router.get('/', async (req, res) => {
  const { lat = -0.2833, lon = 36.0667 } = req.query;
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) return res.status(500).json({ error: 'Weather API key not configured' });

  try {
    const [currentRes, forecastRes] = await Promise.all([
      axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`),
      axios.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&cnt=40`)
    ]);

    const current = currentRes.data;
    const forecast = forecastRes.data;

    // Build 7-day daily forecast (take midday reading each day)
    const dailyMap = {};
    forecast.list.forEach(item => {
      const date = item.dt_txt.split(' ')[0];
      const hour = item.dt_txt.split(' ')[1];
      if (!dailyMap[date] || hour === '12:00:00') dailyMap[date] = item;
    });
    const daily = Object.entries(dailyMap).slice(0, 7).map(([date, item]) => ({
      date,
      day: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
      temp: Math.round(item.main.temp),
      icon: mapWeatherIcon(item.weather[0].main),
      rain_chance: Math.round((item.pop || 0) * 100),
      description: item.weather[0].description
    }));

    // Generate crop-specific alerts based on conditions
    const alerts = generateCropAlerts(current, forecast.list);

    res.json({
      success: true,
      current: {
        temp: Math.round(current.main.temp),
        feels_like: Math.round(current.main.feels_like),
        description: current.weather[0].description,
        icon: mapWeatherIcon(current.weather[0].main),
        humidity: current.main.humidity,
        wind_speed: Math.round(current.wind.speed * 3.6), // m/s to km/h
        rain_chance: daily[0]?.rain_chance || 0,
        city: current.name,
        country: current.sys.country
      },
      forecast: daily,
      alerts
    });

  } catch (err) {
    console.error('Weather error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

function mapWeatherIcon(main) {
  const map = {
    Clear: '☀️', Clouds: '⛅', Rain: '🌧️',
    Drizzle: '🌦️', Thunderstorm: '⛈️', Snow: '❄️',
    Mist: '🌫️', Fog: '🌫️', Haze: '🌫️'
  };
  return map[main] || '🌤️';
}

function generateCropAlerts(current, forecastList) {
  const alerts = [];
  const humidity = current.main.humidity;
  const temp = current.main.temp;

  // Check next 48h for rain
  const next48h = forecastList.slice(0, 16);
  const highRainSoon = next48h.some(f => (f.pop || 0) > 0.7);
  const avgRain = next48h.reduce((s, f) => s + (f.pop || 0), 0) / next48h.length;

  // Blight conditions: high humidity + rain
  if (humidity > 75 && highRainSoon) {
    alerts.push({
      type: 'danger',
      icon: '🔴',
      title: 'High Blight Risk — Tomatoes & Potatoes',
      desc: `Humidity at ${humidity}% with heavy rain expected. Apply copper-based fungicide before rain arrives.`
    });
  }

  // Rust conditions: warm nights, dew
  if (temp > 18 && temp < 28 && humidity > 60) {
    alerts.push({
      type: 'warning',
      icon: '🟡',
      title: 'Maize Rust Alert',
      desc: 'Warm temperatures and moderate humidity favor rust development. Scout maize leaves for orange pustules.'
    });
  }

  // Good conditions
  if (humidity < 60 && !highRainSoon) {
    alerts.push({
      type: 'info',
      icon: '🟢',
      title: 'Good Conditions for Beans & Rice',
      desc: 'Low disease pressure expected. Ideal time for planting or applying preventive treatments.'
    });
  }

  // Drought warning
  if (humidity < 40 && avgRain < 0.1) {
    alerts.push({
      type: 'warning',
      icon: '🟡',
      title: 'Dry Spell Warning',
      desc: 'Very low humidity and no rain forecast. Ensure adequate irrigation to prevent stress-related disease.'
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      type: 'info',
      icon: '🟢',
      title: 'Normal Conditions',
      desc: 'No major disease risk alerts at the moment. Continue routine scouting and care.'
    });
  }

  return alerts;
}

module.exports = router;
