import React, { useEffect, useMemo, useState } from "react";
import { weatherService, type WeatherData } from "./weatherService";
import {
  Leaf,
  ClipboardList,
  Map,
  ThermometerSun,
  Clock,
  CloudRain,
  Plus,
  Search,
  Image as ImageIcon,
  Wand2,
  Check,
  X,
} from "lucide-react";

/** ------------------ Types ------------------ */
type Orientation = "West" | "East" | "South" | "N/A";
type Area = "Front Yard" | "Back Yard" | "Side Yard" | "South Side" | "Yard (Total)";
export type Zone = {
  id: string;
  name: string;
  area: Area;
  type: string;
  orientation: Orientation;
  sun: string;
  health: number | null;
  notes: string[];
  tags?: string[];
  emoji?: string;
  subzones?: Zone[];
};

/** ------------------ Constants ------------------ */
const CLIMATE = { usda: "8b", sunset: "6" };
const AREAS: ReadonlyArray<"All" | Area> = ["All", "Front Yard", "Back Yard", "Side Yard", "South Side"] as const;
const SCHEMA_VERSION = 4;
const DEFAULT_AI_PROXY = "/api/identify";

/** ------------------ Helpers ------------------ */
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const BASE_ZONES: Zone[] = [
  {
    id: uid(),
    name: "Pond",
    area: "Front Yard",
    type: "Pond + ornamentals",
    orientation: "West",
    sun: "Afternoon sun (algae‑prone)",
    emoji: "🐸",
    health: null,
    notes: [
      "Skim debris; clean filter mid‑late summer",
      "Monitor algae; shade or barley straw if bloom",
    ],
  },
  {
    id: uid(),
    name: "Mulch Bed",
    area: "Front Yard",
    type: "Maple + perennials (mulched)",
    orientation: "West",
    sun: "Partial shade",
    emoji: "🍁",
    health: null,
    notes: [
      "Keep mulch off trunk flare (3–4\" ring)",
      "Light summer water if 7+ dry days",
    ],
    subzones: [
      {
        id: uid(),
        name: "Japanese Maple (front)",
        area: "Front Yard",
        type: "Acer palmatum",
        orientation: "West",
        sun: "PM sun, AM shade",
        emoji: "🌳",
        health: null,
        notes: [
          "Avoid heavy pruning in summer heat",
          "Slow‑release feed in spring only",
        ],
      },
    ],
  },
  {
    id: uid(),
    name: "Grass Lawn (Back)",
    area: "Back Yard",
    type: "Turfgrass (cool‑season fescue mix)",
    orientation: "East",
    sun: "Morning sun, afternoon shade",
    emoji: "🌿",
    health: null,
    notes: [
      "Mow ~3.5–4\"",
      "Overseed thin areas mid–late Sept",
      "Slow‑release N late Sept",
    ],
  },
  {
    id: uid(),
    name: "Azaleas (left of Garden Bed)",
    area: "Back Yard",
    type: "Shrubs (Azaleas)",
    orientation: "East",
    sun: "Partial shade",
    emoji: "🌸",
    health: null,
    notes: [
      "Keep evenly moist until fall rains",
      "Mulch 2–3\"; avoid crown",
      "Acidic feed after bloom only (spring)",
    ],
  },
  {
    id: uid(),
    name: "Shrubs (sparse plantings)",
    area: "Back Yard",
    type: "Shrubs",
    orientation: "East",
    sun: "Variable",
    emoji: "🪴",
    health: null,
    notes: ["Audit in fall; plan fills for spring"],
  },
  {
    id: uid(),
    name: "Garden Bed",
    area: "Back Yard",
    type: "Soil prep area",
    orientation: "East",
    sun: "Full morning sun, afternoon shade",
    emoji: "🥕",
    health: null,
    notes: [
      "Top up compost; broadfork if compacted",
      "Plan fall cover crop (crimson clover/rye)",
    ],
  },
  {
    id: uid(),
    name: "Deck Perimeter (future)",
    area: "South Side",
    type: "Deck plantings",
    orientation: "South",
    sun: "Full sun, hottest zone",
    emoji: "🌞",
    health: null,
    notes: ["Trial drought‑tolerant perennials next year"],
  },
];

/** ------------------ Storage ------------------ */
const ZKEY = "yardboy-zones";
const SKEY = "yardboy-schema";
const QDONE = "yardboy-quests-done";

function isZone(obj: any): obj is Zone {
  return obj && typeof obj === "object" && typeof obj.name === "string" && typeof obj.area === "string";
}

function safeLoadZones(): Zone[] {
  try {
    const storedSchema = Number(localStorage.getItem(SKEY) || 0);
    if (storedSchema !== SCHEMA_VERSION) {
      localStorage.setItem(ZKEY, JSON.stringify(BASE_ZONES));
      localStorage.setItem(SKEY, String(SCHEMA_VERSION));
      return BASE_ZONES;
    }
    const raw = localStorage.getItem(ZKEY);
    if (!raw) return BASE_ZONES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return BASE_ZONES;
    const clean = parsed.filter(isZone);
    return clean.length ? clean : BASE_ZONES;
  } catch {
    return BASE_ZONES;
  }
}

function saveZones(z: Zone[]) {
  localStorage.setItem(ZKEY, JSON.stringify(z));
}

/** ------------------ Quests ------------------ */
const QUESTS = [
  { text: "Keep azaleas watered weekly until rains", freq: "weekly" },
  { text: "Decide watering vs dormancy for front (west) lawn", freq: "biweekly" },
  { text: "Overseed patchy spots mid–late Sept (fescue)", freq: "once" },
  { text: "First fall fertilizer late Sept (slow‑release N)", freq: "once" },
  { text: "Prep/compost garden bed; consider cover crop", freq: "once" },
];

/** ------------------ UI helpers ------------------ */
const SectionCard: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className = "", children }) => (
  <div className={`rounded-2xl bg-white shadow-sm border border-emerald-100 p-4 md:p-5 ${className}`}>{children}</div>
);

const ProgressBar = ({ value }: { value: number }) => (
  <div className="w-full h-2.5 bg-emerald-100 rounded-full overflow-hidden">
    <div className="h-full bg-emerald-600" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);

/** ------------------ Plant ID helpers ------------------ */
async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(binary);
}

type PlantSuggestion = { name: string; probability: number; details?: { common_names?: string[]; watering?: string[]; sunlight?: string[]; url?: string; } };

async function identifyViaProxy(file: File, proxyUrl: string): Promise<PlantSuggestion[]> {
  const b64 = await fileToBase64(file);
  const res = await fetch(proxyUrl || DEFAULT_AI_PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: b64 }),
  });
  if (!res.ok) throw new Error(`Proxy identify: HTTP ${res.status}`);
  const data = await res.json();
  const list: PlantSuggestion[] = (data?.suggestions || []).slice(0, 3);
  if (!list.length) throw new Error("No suggestions returned");
  return list;
}

/** ------------------ Add Plant Modal ------------------ */
function AddPlantModal({
  open,
  onClose,
  onCreate,
  defaultArea,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (z: Zone) => void;
  defaultArea: Area;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🪴");
  const [type, setType] = useState("Plant");
  const [sun, setSun] = useState("Unknown");
  const [area, setArea] = useState<Area>(defaultArea);
  const [file, setFile] = useState<File | null>(null);
  const [suggestions, setSuggestions] = useState<PlantSuggestion[] | null>(null);
  const [aiChosen, setAiChosen] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setEmoji("🪴");
      setType("Plant");
      setSun("Unknown");
      setArea(defaultArea);
      setFile(null);
      setSuggestions(null);
      setAiChosen(0);
      setLoading(false);
      setError(null);
    }
  }, [open, defaultArea]);

  const runAI = async () => {
    if (!file) {
      setError("Add a photo first.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await identifyViaProxy(file, DEFAULT_AI_PROXY);
      setSuggestions(res);
      if (res[0]) {
        setName(res[0].name);
        setType(res[0].details?.common_names?.[0] ? `${res[0].details?.common_names?.[0]} (AI)` : "Plant (AI)");
        // crude sun hint mapping from API details if present
        const s = (res[0].details?.sunlight || []).join(", ");
        if (s) setSun(s);
      }
    } catch (e: any) {
      setError(e?.message || "AI identify failed.");
    } finally {
      setLoading(false);
    }
  };

  const accept = () => {
    const z: Zone = {
      id: uid(),
      name: name || suggestions?.[aiChosen]?.name || "New Plant",
      area,
      type,
      orientation: area === "Front Yard" ? "West" : area === "Back Yard" ? "East" : area === "South Side" ? "South" : "N/A",
      sun,
      emoji,
      health: null,
      notes: [
        "Newly added plant — monitor water the first 2 weeks.",
      ],
    };
    onCreate(z);
    onClose();
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl border border-emerald-100">
        <div className="flex items-center justify-between p-4 border-b border-emerald-100">
          <div className="flex items-center gap-2">
            <Wand2 className="text-emerald-700" />
            <h3 className="text-lg font-semibold text-emerald-900">Add plant</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-emerald-50">
            <X />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-emerald-700">Name</label>
              <input className="w-full mt-1 rounded-xl border border-emerald-200 bg-white px-3 py-2"
                value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Sword fern" />
            </div>
            <div>
              <label className="text-xs font-medium text-emerald-700">Emoji</label>
              <input className="w-full mt-1 rounded-xl border border-emerald-200 bg-white px-3 py-2"
                value={emoji} onChange={e => setEmoji(e.target.value)} placeholder="🪴" />
            </div>
            <div>
              <label className="text-xs font-medium text-emerald-700">Type</label>
              <input className="w-full mt-1 rounded-xl border border-emerald-200 bg-white px-3 py-2"
                value={type} onChange={e => setType(e.target.value)} placeholder="Shrub / Perennial / Tree" />
            </div>
            <div>
              <label className="text-xs font-medium text-emerald-700">Area</label>
              <select className="w-full mt-1 rounded-xl border border-emerald-200 bg-white px-3 py-2"
                value={area} onChange={e => setArea(e.target.value as Area)}>
                {AREAS.filter(a => a !== "All").map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-emerald-700">Sun</label>
              <input className="w-full mt-1 rounded-xl border border-emerald-200 bg-white px-3 py-2"
                value={sun} onChange={e => setSun(e.target.value)} placeholder="Full sun / Partial shade / etc." />
            </div>
          </div>

          <div className="rounded-xl border border-emerald-100 p-3">
            <div className="text-sm font-medium text-emerald-900 mb-2 flex items-center gap-2">
              <ImageIcon className="text-emerald-700" /> Photo + AI (optional)
            </div>
            <input type="file" accept="image/*"
              onChange={e => setFile(e.target.files?.[0] || null)} />
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={runAI}
                disabled={!file || loading}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Wand2 size={16} /> {loading ? "Identifying…" : "AI identify"}
              </button>
              {error && <span className="text-sm text-amber-700">{error}</span>}
            </div>

            {suggestions && (
              <div className="mt-3 space-y-2">
                <div className="text-sm text-emerald-800">
                  I think it’s <strong>{suggestions[aiChosen]?.name}</strong> ({Math.round((suggestions[aiChosen]?.probability || 0) * 100)}%),
                  but could be {suggestions.filter((_,i)=>i!==aiChosen).map(s=>s.name).join(" or ")}.
                </div>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s, i) => (
                    <button key={s.name + i}
                      onClick={() => { setAiChosen(i); setName(s.name); }}
                      className={`px-3 py-1.5 rounded-full text-sm border ${aiChosen === i ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-emerald-200 text-emerald-800"}`}>
                      {s.name} • {Math.round(s.probability * 100)}%
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-emerald-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-200">
            <X size={16}/> Cancel
          </button>
          <button onClick={accept} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">
            <Check size={16}/> Save plant
          </button>
        </div>
      </div>
    </div>
  );
}

/** ------------------ Main ------------------ */
export default function YardboyDashboard() {
  const [zones, setZones] = useState<Zone[]>(() => safeLoadZones());
  const [areaFilter, setAreaFilter] = useState<(typeof AREAS)[number]>("All");
  const [query, setQuery] = useState("");
  const [showBuilder, setShowBuilder] = useState(false);

  const [checks, setChecks] = useState<boolean[]>(() => {
    try {
      const raw = localStorage.getItem(QDONE);
      if (!raw) return Array(QUESTS.length).fill(false);
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.slice(0, QUESTS.length) : Array(QUESTS.length).fill(false);
    } catch {
      return Array(QUESTS.length).fill(false);
    }
  });

  useEffect(() => saveZones(zones), [zones]);
  useEffect(() => localStorage.setItem(QDONE, JSON.stringify(checks)), [checks]);

  const toggleQuest = (i: number) => {
    setChecks(prev => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  };

  const visibleTasks = useMemo(() => {
    const order = { weekly: 0, biweekly: 1, once: 2 } as Record<string, number>;
    return [...QUESTS].sort((a, b) => order[a.freq] - order[b.freq]);
  }, []);

  const done = checks.filter(Boolean).length;
  const total = QUESTS.length;
  const pct = Math.round((done / Math.max(1, total)) * 100);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return zones.filter((z) => {
      const areaOk = areaFilter === "All" ? true : z.area === areaFilter;
      const text = (z.name + " " + z.type + " " + (z.tags || []).join(" ") + " " + z.sun).toLowerCase();
      return areaOk && (q ? text.includes(q) : true);
    });
  }, [zones, areaFilter, query]);

  // Live weather data
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // Fetch weather data on component mount
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setWeatherLoading(true);
        setWeatherError(null);
        const data = await weatherService.getCurrentWeather();
        setWeatherData(data);
      } catch (error) {
        console.error('Failed to fetch weather:', error);
        setWeatherError('Weather data unavailable');
        setWeatherData(weatherService.getFallbackData());
      } finally {
        setWeatherLoading(false);
      }
    };

    fetchWeather();
    
    // Refresh weather every 30 minutes
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Use weather data or fallback
  const currentWeather = weatherData || weatherService.getFallbackData();

  return (
    <div className="min-h-screen bg-emerald-50 text-emerald-950">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/YARDBOY.svg" alt="Yardboy" className="h-8 w-auto" />
            <div>
              <h1 className="text-xl font-semibold">v1</h1>
            </div>
          </div>
          <div className="hidden md:flex gap-6 text-sm text-emerald-800">
            <div>USDA<br/><strong>Zone {CLIMATE.usda}</strong></div>
            <div>Sunset<br/><strong>Zone {CLIMATE.sunset}</strong></div>
          </div>
        </div>

        {/* Quest Log and Today Info - Two Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Seasonal Quest Log */}
          <SectionCard>
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList className="text-emerald-700" />
              <h2 className="text-lg font-semibold text-emerald-900">Seasonal Quest Log</h2>
            </div>
            <div className="text-sm text-emerald-700 mb-3">Late Summer → Early Fall (Aug–Sept)</div>
            <div className="mb-3">
              <div className="flex items-center justify-between text-sm text-emerald-800 mb-1">
                <span>Progress</span>
                <span><strong>{done}</strong>/{total} ({pct}%)</span>
              </div>
              <ProgressBar value={pct} />
            </div>
            <ul className="pl-1 text-sm space-y-1">
              {visibleTasks.map((task, i) => {
                const checked = checks[i] || false;
                return (
                  <li key={`task-${i}`} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-emerald-600"
                      checked={checked}
                      onChange={() => toggleQuest(i)}
                    />
                    <span className={checked ? "line-through opacity-60" : ""}>{task.text}</span>
                  </li>
                );
              })}
            </ul>
          </SectionCard>

          {/* Today */}
          <SectionCard>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Clock className="text-emerald-700" />
                <h2 className="text-lg font-semibold text-emerald-900">Today</h2>
                {weatherLoading && (
                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Loading...</span>
                )}
                {weatherError && (
                  <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">Offline</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="px-2.5 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-900">This Month: <strong>{done}</strong>/{total} ({pct}%)</span>
              </div>
            </div>
            <div className="mb-4">
                          <div className="flex items-center justify-between text-sm text-emerald-800 mb-1">
              <span>Sunrise: <strong>{currentWeather.sunrise}</strong></span>
              <span>Sunset: <strong>{currentWeather.sunset}</strong></span>
            </div>
            <div className="h-2.5 w-full bg-emerald-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400" style={{ width: `${Math.round(currentWeather.daylightPercent)}%` }} />
            </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <ThermometerSun className="text-emerald-700" />
                <div className="text-sm text-emerald-800">
                  <div className="text-emerald-900 font-semibold">
                    {weatherLoading ? "Loading..." : `${currentWeather.temperature.current}°F`}
                  </div>
                  <div className="text-emerald-700">
                    min {currentWeather.temperature.min}°F / max {currentWeather.temperature.max}°F
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CloudRain className="text-emerald-700" />
                <div className="text-sm text-emerald-800">
                  <div className="text-emerald-900 font-semibold">
                    Rain {weatherLoading ? "—" : `${currentWeather.rain.probability}%`}
                  </div>
                  <div className="text-emerald-700">
                    Total {weatherLoading ? "—" : `${currentWeather.rain.total} in`}
                  </div>
                </div>
              </div>
              <div />
            </div>
          </SectionCard>
        </div>

        {/* Zones */}
        <SectionCard>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Map className="text-emerald-700" />
              <h2 className="text-lg font-semibold text-emerald-900">Zones</h2>
            </div>
            <button
              onClick={() => setShowBuilder(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Plus size={16} /> Add plant
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            {AREAS.map((a) => (
              <button
                key={a}
                onClick={() => setAreaFilter(a)}
                className={`px-3 py-1.5 rounded-full text-sm border ${areaFilter === a ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-emerald-200 text-emerald-800"}`}
              >
                {a}
              </button>
            ))}
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-2.5 text-emerald-600" size={18} />
            <input
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-emerald-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
              placeholder="Search zones, types, tags…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((z) => (
              <div key={z.id} className="rounded-2xl border border-emerald-100 bg-white p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{z.emoji || "🪴"}</span>
                      <h3 className="font-semibold text-emerald-900">{z.name}</h3>
                    </div>
                    <div className="text-sm text-emerald-700">{z.type}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800">{z.area}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <span className="px-2 py-0.5 rounded-md text-xs bg-lime-100 text-lime-800">{z.sun}</span>
                </div>

                <details className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                  <summary className="cursor-pointer text-sm text-emerald-800">Care notes</summary>
                  <ul className="list-disc pl-5 mt-2 text-sm space-y-1">
                    {z.notes.map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                </details>

                {z.subzones && (
                  <div className="border-t border-emerald-100 pt-2">
                    <div className="text-xs font-semibold text-emerald-700 mb-1">Subzones</div>
                    <div className="flex flex-col gap-2">
                      {z.subzones.map((s) => (
                        <div key={s.id} className="rounded-xl border border-emerald-100 bg-white p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{s.emoji || "🌿"}</span>
                            <div>
                              <div className="text-sm font-medium text-emerald-900">{s.name}</div>
                              <div className="text-xs text-emerald-700">{s.type} • {s.sun}</div>
                            </div>
                          </div>
                          <ul className="list-disc pl-5 mt-2 text-sm space-y-1">
                            {s.notes.map((n, i) => <li key={i}>{n}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>

      </div>

      {/* Modal */}
      <AddPlantModal
        open={showBuilder}
        onClose={() => setShowBuilder(false)}
        defaultArea={areaFilter === "All" ? "Front Yard" : (areaFilter as Area)}
        onCreate={(z) => setZones(prev => [z, ...prev])}
      />
    </div>
  );
}
