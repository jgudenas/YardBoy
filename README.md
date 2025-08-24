# Yardboy v1

Personal yard dashboard + PlantID proxy (Vercel).

## Scripts
- `npm install`
- `npm run dev` (local)
- `npm run build` (production)
- `npm run preview` (serve built)

## Weather API Setup
1. Get a free API key from [OpenWeatherMap](https://openweathermap.org/api)
2. Create a `.env` file in your project root:
   ```
   VITE_OPENWEATHER_API_KEY=your_api_key_here
   VITE_DEFAULT_CITY=Your City, State
   ```
3. The app uses One Call API 3.0 for efficient weather data
4. Automatically fetches live temperature, rain, and sunrise/sunset data
5. Weather refreshes every 30 minutes

## Deploy (Vercel)
1. Add env var `PLANT_ID_KEY` in Vercel (Production + Preview).
2. Add env var `VITE_OPENWEATHER_API_KEY` in Vercel (Production + Preview).
3. Import this repo; build with Vite.
4. Domain: add `yard.joeyg.xyz` and CNAME it in GoDaddy.
5. UI will call `/api/identify` so no browser key is needed.

Paste your full React dashboard into `src/App.tsx`.