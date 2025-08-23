# Yardboy v1

Personal yard dashboard + PlantID proxy (Vercel).

## Scripts
- `npm install`
- `npm run dev` (local)
- `npm run build` (production)
- `npm run preview` (serve built)

## Deploy (Vercel)
1. Add env var `PLANT_ID_KEY` in Vercel (Production + Preview).
2. Import this repo; build with Vite.
3. Domain: add `yard.joeyg.xyz` and CNAME it in GoDaddy.
4. UI will call `/api/identify` so no browser key is needed.

Paste your full React dashboard into `src/App.tsx`.