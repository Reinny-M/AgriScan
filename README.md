# 🌿 AgriScan — Full Stack Setup Guide

## Stack
- **Frontend:** HTML/CSS/JS (Vercel static)
- **Backend:** Node.js + Express (Vercel Serverless)
- **Database:** Supabase (PostgreSQL)
- **AI:** Groq — llama-4-scout-17b (vision)
- **Weather:** OpenWeatherMap
- **Maps:** Leaflet.js + OpenStreetMap (free, no key needed)
- **Directions:** OpenRouteService (free tier)
- **Payments:** M-Pesa Daraja + Flutterwave

---

## 1. Supabase Setup
1. Go to https://supabase.com → New Project
2. Copy your **Project URL** and **service_role key** from Settings → API
3. Run `supabase/schema.sql` in the Supabase SQL Editor

---

## 2. Environment Variables
Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
```

| Variable | Where to get it | Cost |
|---|---|---|
| `SUPABASE_URL` | Supabase → Settings → API | Free |
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API | Free |
| `GROQ_API_KEY` | console.groq.com | Free |
| `OPENWEATHER_API_KEY` | openweathermap.org/api | Free (1000/day) |
| `ORS_API_KEY` | openrouteservice.org | Free (2000/day) |
| `MPESA_CONSUMER_KEY` | developer.safaricom.co.ke | Free (sandbox) |
| `MPESA_CONSUMER_SECRET` | developer.safaricom.co.ke | Free (sandbox) |
| `FLUTTERWAVE_SECRET_KEY` | flutterwave.com | Free (test mode) |

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
Add all `.env` variables in **Vercel Dashboard → Project → Settings → Environment Variables**.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/analyze` | Analyze plant image with Groq AI |
| GET | `/api/weather?lat=&lon=` | Get weather + crop alerts |
| GET | `/api/shops?lat=&lon=` | Get nearby agro-vet shops |
| POST | `/api/shops` | Add a new shop |
| GET | `/api/crops` | Get crop disease library |
| POST | `/api/scans` | Save a scan result |
| GET | `/api/scans/:farmerId` | Get farmer scan history |
| POST | `/api/farmers` | Register / find farmer |
| GET | `/api/farmers/:id` | Get farmer profile |
| POST | `/api/mpesa/stk-push` | Initiate M-Pesa STK push |
| GET | `/api/mpesa/status/:id` | Poll payment status |
| POST | `/api/mpesa/callback` | Daraja webhook |
| POST | `/api/flutterwave/initiate` | Start Flutterwave payment |
| GET | `/api/flutterwave/verify/:ref` | Verify payment |
| GET | `/api/maps/config` | Get ORS key for frontend |

---

## File Structure
```
agriscan/
├── public/
│   └── index.html          ← Full frontend UI
├── api/
│   ├── server.js           ← Express entry point
│   ├── supabase.js         ← Supabase client
│   └── routes/
│       ├── analyze.js      ← Groq vision AI
│       ├── weather.js      ← OpenWeatherMap
│       ├── shops.js        ← Agro-vet shops
│       ├── crops.js        ← Crop library
│       ├── farmers.js      ← Farmer registration
│       ├── scans.js        ← Scan history
│       ├── mpesa.js        ← M-Pesa Daraja
│       ├── flutterwave.js  ← Card payments
│       └── maps.js         ← ORS config
├── supabase/
│   └── schema.sql          ← Database schema + seed data
├── .env.example            ← Environment template
├── vercel.json             ← Vercel deployment config
└── package.json
```
