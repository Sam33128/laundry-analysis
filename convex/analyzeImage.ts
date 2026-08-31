import { action } from "./_generated/server";
import { v } from "convex/values";

// 🌦️ WEATHER
async function getWeather(lat: number, lon: number) {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m`
  );

  const data = await res.json();

  return {
    temperature: data.current?.temperature_2m ?? 25,
    humidity: data.current?.relative_humidity_2m ?? 50,
    wind_speed: data.current?.wind_speed_10m ?? 1,
  };
}

// 🔥 WEATHER FACTOR
function weatherFactor(temp: number, humidity: number, wind: number) {
  temp = Math.max(temp, 5);
  humidity = Math.min(Math.max(humidity, 10), 100);
  wind = Math.max(wind, 0);

  let factor = 1;
  factor *= humidity / 50;
  factor *= 30 / temp;
  factor *= 1 / (1 + wind * 0.1);

  return factor;
}

// 🔥 DRYING LOGIC
function getDryingTime(data: any) {
  const baseTime = 120;

  const fabricFactor: any = {
    cotton: 1.2,
    polyester: 0.8,
    denim: 1.5,
    wool: 1.4,
    unknown: 1.0,
  };

  const typeFactor: any = {
    "t-shirt": 1.0,
    shirt: 1.1,
    jeans: 1.5,
    towel: 1.4,
    pants: 1.3,
    shorts: 0.9,
    dress: 1.2,
    unknown: 1.0,
  };

  const moistureFactor: any = {
    low: 0.7,
    medium: 1.0,
    high: 1.5,
  };

  const sunFactor: any = {
    low: 1.3,
    medium: 1.0,
    high: 0.7,
  };

  const placementFactor: any = {
    indoor_closed: 1.5,
    indoor_ventilated: 1.2,
    outdoor_shade: 1.1,
    outdoor_sun: 0.8,
  };

  return (
    baseTime *
    (fabricFactor[data.fabric] || 1) *
    (typeFactor[data.type] || 1) *
    (moistureFactor[data.moisture] || 1) *
    (sunFactor[data.sun] || 1) *
    (placementFactor[data.placement] || 1) *
    weatherFactor(data.temperature, data.humidity, data.wind_speed)
  );
}

// 🚀 MAIN ACTION
export const analyzeImage = action({
  args: {
    imageUrl: v.string(),
    moisture: v.string(),
    sun: v.string(),
    placement: v.string(),
    lat: v.number(),
    lon: v.number(),
  },

  handler: async (ctx, args) => {
    try {
      // 🔴 CALL NVIDIA
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
            max_tokens: 200,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Return ONLY valid JSON.
NO explanation.
NO text.
NO markdown.

Schema:
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
                    image_url: { url: args.imageUrl },
                  },
                ],
              },
            ],
          }),
        }
      );

      if (!res.ok) {
        return {
          error: "NVIDIA API failed",
          status: res.status,
          details: await res.text(),
        };
      }

      const data = await res.json();
      const raw = data?.choices?.[0]?.message?.content;

      if (!raw) return { error: "No response from model" };

      // 🔥 STRONG JSON EXTRACTION
      const cleaned = raw
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      const match = cleaned.match(/\{[\s\S]*\}/);

      if (!match) {
        return {
          error: "No JSON found",
          raw: cleaned,
        };
      }

      let parsed;
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        return {
          error: "Invalid JSON",
          raw: cleaned,
        };
      }

      if (!Array.isArray(parsed.garments)) {
        return { error: "Invalid structure", parsed };
      }

      // 🌦️ WEATHER (REAL LOCATION)
      const weather = await getWeather(args.lat, args.lon);

      // 🔥 TOTAL TIME
      let totalTime = 0;

      for (const g of parsed.garments) {
        totalTime += getDryingTime({
          fabric: g.fabric || "unknown",
          type: g.type || "unknown",
          temperature: weather.temperature,
          humidity: weather.humidity,
          wind_speed: weather.wind_speed,
          moisture: args.moisture,
          sun: args.sun,
          placement: args.placement,
        });
      }

      return {
        ...parsed,
        weather,
        drying_time_minutes: Math.round(totalTime),
      };
    } catch (err) {
      return {
        error: "API call failed",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  },
}); 