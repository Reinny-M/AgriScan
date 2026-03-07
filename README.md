# 🌿 AgriScan — Full Stack Setup Guide

## Stack
- **Frontend:** HTML/CSS/JS (Vercel)
- **Backend:** Node.js + Express (Vercel Serverless Functions)
- **Database:** Supabase (PostgreSQL)
- **AI:** Google Gemini 1.5 Flash
- **Weather:** OpenWeatherMap API

---

## 1. Supabase Setup

1. Go to https://supabase.com → New Project
2. Copy your **Project URL** and **anon key** from Settings → API
3. Run the SQL in `supabase/schema.sql` in the Supabase SQL Editor

---

## 2. Environment Variables

Create a `.env` file in the root:

```
GEMINI_API_KEY=your_gemini_key_here
OPENWEATHER_API_KEY=your_openweather_key_here
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
```

Get API keys:
- Gemini: https://aistudio.google.com → Get API Key (FREE)
- OpenWeather: https://openweathermap.org/api → Free tier (1000 calls/day)
- Supabase: Project Settings → API

---

## 3. Local Development

```bash
npm install
npm run dev
```

Visit http://localhost:3000

---

## 4. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Then add all `.env` variables in Vercel Dashboard → Project → Settings → Environment Variables.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/analyze` | Analyze plant image with Gemini AI |
| GET | `/api/weather?lat=&lon=` | Get weather + crop alerts |
| GET | `/api/shops?lat=&lon=` | Get nearby agro-vet shops |
| POST | `/api/shops` | Add a new shop (admin) |
| GET | `/api/crops` | Get crop disease library |
| POST | `/api/scans` | Save a scan result |
| GET | `/api/scans/:farmerId` | Get farmer scan history |
