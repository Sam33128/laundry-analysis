"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { Buffer } from "buffer";

// 🌦️ WEATHER
async function getWeather(lat: number, lon: number) {
  const fetchLat = lat === 20 ? 20.2961 : lat;
  const fetchLon = lon === 85 ? 85.8245 : lon;
  
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${fetchLat}&longitude=${fetchLon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m`
  );

  const data = await res.json();
  return {
    temperature: data.current?.temperature_2m ?? 25,
    humidity: data.current?.relative_humidity_2m ?? 50,
    wind_speed: data.current?.wind_speed_10m ?? 1,
  };
}

// 🚀 MAIN ACTION
export const analyzeImage = action({
  args: {
    imageUrl: v.string(), // Accept URL directly from frontend
    moisture: v.string(),
    sun: v.string(),
    placement: v.string(),
    lat: v.number(),
    lon: v.number(),
  },

  handler: async (ctx, args) => {
    try {
      // 🔴 STEP 1: FETCH IMAGE VIA HTTP
      const imgRes = await fetch(args.imageUrl);
      if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`);

      const buffer = await imgRes.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      
      const mimeType = imgRes.headers.get("content-type") || "image/jpeg";
      const dataUrl = `data:${mimeType};base64,${base64}`;

      // 🔴 STEP 2: SEND TO NVIDIA
      const res = await fetch(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "meta/llama-3.2-11b-vision-instruct",
            temperature: 0,
            max_tokens: 400,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Return ONLY valid JSON without markdown formatting. Schema:
{
  "total_garments": number,
  "garments": [
    {
      "type": "t-shirt | shirt | towel | jeans | pants | shorts | dress | unknown",
      "fabric": "cotton | polyester | wool | denim | unknown"
    }
  ]
}`,
                  },
                  {
                    type: "image_url",
                    image_url: { url: dataUrl },
                  },
                ],
              },
            ],
          }),
        }
      );

      const rawText = await res.text();
      if (!res.ok) throw new Error(`NVIDIA API failed: ${res.status} - ${rawText}`);

      const data = JSON.parse(rawText);
      const raw = data?.choices?.[0]?.message?.content;
      if (!raw) throw new Error("No response from model");

      // 🔴 STEP 3: STRICT JSON PARSING
      const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error(`No JSON found. Raw output: ${cleaned}`);

      const parsed = JSON.parse(match[0]);
      const weather = await getWeather(args.lat, args.lon);

      return {
        ...parsed,
        weather,
        drying_time_minutes: parsed.total_garments ? parsed.total_garments * 25 : 120,
      };
    } catch (err) {
      console.error("Action Error:", err);
      return {
        error: "API failed",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  },
});