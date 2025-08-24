// api/identify.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
    const { imageBase64 } = req.body || {};
    if (!imageBase64) return res.status(400).json({ error: "imageBase64 required" });

    const r = await fetch("https://api.plant.id/v2/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.PLANT_ID_KEY,
        images: [imageBase64],
        modifiers: ["crops_fast", "similar_images"],
        plant_language: "en",
        plant_details: ["common_names","url","wiki_description","watering","sunlight"]
      }),
    });

    if (!r.ok) return res.status(r.status).json({ error: `plant.id ${r.status}` });
    const data = await r.json();
    const suggestions = (data?.suggestions || []).slice(0, 3).map((s: any) => ({
      name: s.plant_name || s.name || "Unknown",
      probability: typeof s.probability === "number" ? s.probability : 0,
      details: {
        common_names: s?.plant_details?.common_names || [],
        watering: s?.plant_details?.watering || [],
        sunlight: s?.plant_details?.sunlight || [],
        url: s?.plant_details?.url,
      },
    }));
    res.json({ suggestions });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "proxy error" });
  }
}