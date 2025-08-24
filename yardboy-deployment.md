# 🌱 Yardboy — Deploy & Dev Guide

A single-page cheat sheet you can keep in the repo. Covers: **how to ship**, **what’s in the app**, and **where it’s going**.

---

## 1) Simple Deployment & Commands Flow

### A. Daily loop (feature → preview → prod)
```bash
# get latest main
git pull origin main

# branch for your change
git checkout -b feat/<short-name>

# run locally
npm run dev   # http://localhost:5173

# commit as you go
git add .
git commit -m "Short, clear message"

# push branch and open PR in GitHub
git push -u origin feat/<short-name>
```
- Open the Pull Request on GitHub.
- Click the **Vercel Preview** link to test on real hosting (proxy + env vars).
- When it’s good: **Merge** to `main` → Vercel auto-deploys to **yardboy.joeyg.xyz**.

### B. First-time project setup (already done)
- Repo: GitHub (`main` = production)
- Hosting: Vercel (project imported from GitHub)
- Domain: `yardboy.joeyg.xyz` (CNAME to Vercel)
- Env vars (Vercel → Project → Settings → Environment Variables):
  - `PLANT_ID_KEY = <your Plant.id key>`

### C. Useful one-liners
```bash
# start dev from anywhere
cd ~/Desktop/00_joey/00_yardboy && npm run dev

# build & preview production locally
npm run build && npm run preview
```

### D. Rollback if needed
- Vercel → Project → **Deployments** → pick a previous build → **Promote to Production**.

---

## 2) App Structure (What’s Where)

```
yardboy/
├─ api/
│  └─ identify.ts           # Vercel function; calls Plant.id using PLANT_ID_KEY
├─ public/                  # static assets (optional)
├─ src/
│  ├─ App.tsx               # main dashboard (UI + logic)
│  ├─ main.tsx              # React entry, imports index.css
│  └─ index.css             # Tailwind directives
├─ index.html
├─ package.json             # scripts: dev/build/preview
├─ tsconfig.json
├─ vite.config.ts
├─ tailwind.config.js       # Tailwind content paths
└─ postcss.config.js        # Tailwind + autoprefixer plugins
```

### Key files & responsibilities

**`src/App.tsx`** (single-file app for now)
- **Header**: title + climate pills (USDA 8b, Sunset 6).
- **Seasonal Quest Log**: checklist with strike-through, progress bar.
- **Today**: sunrise/sunset bar + temp/rain (currently placeholders).
- **Zones**: filterable grid (All/Front/Back/Side/South), search, care notes.
- **Add Plant Modal**:
  - Photo + AI identify (top-3 suggestions).
  - Manual fields (name/emoji/type/sun/area).
  - On save → creates a new zone and persists it.

**State & data**
- `BASE_ZONES`: initial seed of your real yard (no dummy data).
- `SCHEMA_VERSION`: bump when the shape of stored data changes.
- `safeLoadZones()`: loads from `localStorage`, reseeds on schema bump.
- Keys in `localStorage`:
  - `yardboy-zones` – all zones/subzones
  - `yardboy-schema` – current schema version
  - `yardboy-quests-done` – checklist booleans

**Styling**
- TailwindCSS with utility classes (`bg-emerald-50`, `rounded-2xl`, etc.).
- `tailwind.config.js` includes:
  ```js
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"]
  ```
- `src/index.css` starts with:
  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
  ```

**Serverless API (no browser keys)**
- `api/identify.ts` (Vercel)
  - Receives `{ imageBase64 }`
  - Calls `https://api.plant.id/v2/identify` with `process.env.PLANT_ID_KEY`
  - Returns top 3 `{ name, probability, details }`
- Frontend uses `fetch("/api/identify", { ... })`

**Build & deploy**
- Vite:
  - `npm run build` → outputs to `dist/`
- SPA routing:
  - `vercel.json` rewrite to `/` (if needed for refresh on nested routes)

---

## 3) Future Features (Backlog Parking Lot)

### Near-term (impactful, low friction)
- **Live weather + daylight**  
  Pull Portland (SW) data from Open-Meteo or NOAA and populate Today.
- **Health rating per zone**  
  0–100 slider with color pill; trend over time.
- **Export / import**  
  Download/restore your full yard JSON to avoid data loss.

### UX polish
- **Photo gallery per zone**  
  Drag-and-drop, compare this season vs next.
- **Inline edit for notes**  
  Click to add/drag re-order care notes.
- **Better progress chip**  
  Per-area progress (Front vs Back vs All).

### Smart care
- **AI care hints**  
  After plant ID, auto-append zone-aware watering/sunlight notes.
- **Weekly agenda**  
  Generate a weekly list from your zones and quests; gamify points.

### Data/infra
- **Provider fallback**  
  If Plant.id rate-limits, fall back to Pl@ntNet behind the same proxy.
- **PWA / offline**  
  Installable app; offline caching for photos & notes.
- **Optional cloud sync**  
  Small server (Supabase/Firestore) to back up zones + images.

---
