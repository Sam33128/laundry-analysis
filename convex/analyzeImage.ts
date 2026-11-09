import { action } from "./_generated/server";
import { v } from "convex/values";

function bufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to aggressively strip markdown formatting from JSON outputs
function parseAIJson(rawText: string) {
  try {
    let cleanText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("RAW AI OUTPUT:\n", rawText);
    throw new Error("Failed to parse JSON from AI response.");
  }
}

async function getLiveWeather(lat?: number, lon?: number) {
  const latitude = lat || 20.2961;
  const longitude = lon || 85.8245;
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,is_day,cloud_cover`
    );
    if (res.ok) {
      const data = await res.json();
      return {
        temperature: data.current?.temperature_2m ?? 28,
        humidity: data.current?.relative_humidity_2m ?? 70,
        wind_speed: data.current?.wind_speed_10m ?? 2,
        is_day: data.current?.is_day ?? 1,
        cloud_cover: data.current?.cloud_cover ?? 20,
      };
    }
  } catch (err) {
    console.warn("Weather fetch failed, applying default weather");
  }
  return { temperature: 28, humidity: 70, wind_speed: 2, is_day: 1, cloud_cover: 20 };
}

function estimateDryingMinutes(
  garments: Array<{ type: string; fabric: string; color?: string }>,
  moisture: string = "medium",
  placement: string = "indoor",
  weather: { temperature: number; humidity: number; wind_speed: number; is_day: number; cloud_cover: number }
): number {
  const baseTimes: Record<string, number> = {
    towel: 50, bath_towel: 65, bedsheet: 60, blanket: 80,
    jeans: 55, pants: 45, t_shirt: 30, shirt: 35, shorts: 25, 
    dress: 40, skirt: 35, sweater: 60, jacket: 75, underwear: 20, socks: 25, 
    dupatta: 20, saree: 45, lehenga: 85, kurta: 35, pyjama: 30, scarf: 20,
    activewear: 25, swimwear: 20, unknown: 40,
  };

  let maxItemTime = 0;
  for (const item of garments) {
    const normalized = (item.type || "unknown").toLowerCase().replace(/[\s-]/g, "_");
    const matchedKey = Object.keys(baseTimes).find((k) => normalized.includes(k)) || "unknown";
    let baseTime = baseTimes[matchedKey];

    const fabric = (item.fabric || "").toLowerCase();
    if (fabric.includes("denim") || fabric.includes("wool") || fabric.includes("terry") || fabric.includes("fleece")) baseTime *= 1.25;
    else if (fabric.includes("polyester") || fabric.includes("nylon") || fabric.includes("silk") || fabric.includes("chiffon") || fabric.includes("georgette")) baseTime *= 0.8;
    else if (fabric.includes("linen") || fabric.includes("khadi")) baseTime *= 0.9;
    
    if (baseTime > maxItemTime) maxItemTime = baseTime;
  }

  if (maxItemTime === 0) maxItemTime = 40; 

  const moistureMultiplier = moisture === "high" ? 1.4 : moisture === "low" ? 0.75 : 1.0;
  
  let placementMultiplier = 1.0;
  if (placement === "indoor") {
    placementMultiplier = 1.8;
  } else {
    if (weather.is_day === 0 || weather.cloud_cover > 60) {
      placementMultiplier = 1.2;
    } else {
      placementMultiplier = 0.85;
    }
  }

  const humidityFactor = weather.humidity > 70 ? 1 + ((weather.humidity - 70) / 30) * 1.2 : 0.95;
  const tempFactor = Math.max(0.6, 1 - (weather.temperature - 25) * 0.015);
  const windFactor = Math.max(0.7, 1 - weather.wind_speed * 0.03);
  const count = garments.length;
  const crowdingFactor = 1 + (Math.max(0, count - 1) * 0.03);

  const calculated = maxItemTime * crowdingFactor * moistureMultiplier * placementMultiplier * humidityFactor * tempFactor * windFactor;
  return Math.max(20, Math.round(calculated));
}

// THE ADAPTIVE MASTER PROMPT
const MASTER_PROMPT = `You are an elite, highly precise laundry and textile classification AI. You must analyze the image and catalog EVERY SINGLE PIECE of clothing visible.

CRITICAL SPATIAL SCANNING RULES:
1. DO NOT GROUP ITEMS. If there are 3 shirts, list 3 separate shirt objects. 
2. ADAPTIVE SCANNING: Scan the image systematically based on how the clothes are arranged. 
   - If on a multi-tier rack, scan tier by tier (top to bottom, left to right).
   - If on a straight clothesline, scan sequentially from one end to the other.
   - If hung irregularly, bunched up, or scattered, scan in a grid pattern from top-left to bottom-right.
3. Look carefully for overlaps, layers, and partially obscured items hanging behind larger garments. Count absolutely EVERYTHING.

CLASSIFICATION DICTIONARIES:
- "type" MUST be one of: t_shirt, shirt, jeans, pants, shorts, dress, skirt, sweater, jacket, underwear, socks, towel, bath_towel, bedsheet, blanket, dupatta, saree, lehenga, kurta, pyjama, scarf, activewear, swimwear. (If unsure, pick the closest match).
- "fabric" MUST be one of: cotton, denim, polyester, wool, silk, linen, nylon, chiffon, georgette, velvet, terry_cloth, fleece, khadi, blend.
- "color" MUST be highly descriptive (e.g., "navy blue", "red and white plaid", "green floral", "black and green tie-dye", "mustard yellow", "faded blue").
- "placement" MUST be "indoor" (if walls, furniture, or studio background are visible) or "outdoor".

STRICT OUTPUT FORMAT RULE:
Output ABSOLUTELY NOTHING but a minified raw JSON object. NO markdown, NO block quotes (\`\`\`), NO conversational text.

Format exactly like this:
{"placement": "indoor", "total_garments": 3, "garments": [{"type": "kurta", "fabric": "cotton", "color": "green patterned"}, {"type": "jeans", "fabric": "denim", "color": "blue"}, {"type": "towel", "fabric": "terry_cloth", "color": "purple"}]}`;

// Dedicated NVIDIA Fetch Logic
async function callNvidiaVisionModel(dataUrl: string, apiKey: string) {
  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "meta/llama-3.2-90b-vision-instruct",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: MASTER_PROMPT },
            { type: "image_url", image_url: { url: dataUrl } }
          ]
        }
      ],
      max_tokens: 1024,
      temperature: 0.1,
      top_p: 1.0,
      stream: false
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("NVIDIA API Error Detail:", errText);
    throw new Error(`NVIDIA API error: ${res.status}`);
  }
  
  const data = await res.json();
  const contentText = data.choices?.[0]?.message?.content;
  
  if (!contentText) {
    throw new Error("NVIDIA returned empty content.");
  }
  
  return parseAIJson(contentText);
}

const LAUNDRY_FUN_FACTS = [
  "The average person washes about 400 loads of laundry a year!",
  "Astronauts burn their dirty underwear in the Earth's atmosphere.",
  "The word 'laundry' comes from the Middle English word 'lavendrye'.",
  "Denim was originally designed as durable workwear for miners.",
  "Over-drying clothes breaks down the fabric fibers faster.",
  "The first washing machine was patented in 1691.",
  "Hanging clothes outside in the sun helps naturally bleach and disinfect them.",
  "Washing clothes in cold water saves up to 90% of the energy used by washing machines.",
  "The longest clothesline ever created was over 30,000 meters long!",
  "Ironing was once done with smooth glass, stones, or wood before metal irons were invented."
];

export const analyzeImage = action({
  args: {
    imageUrl: v.string(),
    moisture: v.optional(v.string()),
    garmentOverride: v.optional(v.string()),
    lat: v.optional(v.number()),
    lon: v.optional(v.number()),
  },

  handler: async (ctx, args) => {
    let detectedGarments = [{ type: "unknown", fabric: "unknown", color: "unknown" }];
    let totalCount = 1;
    let aiPlacement = "indoor";

    if (args.garmentOverride === "auto" && args.imageUrl && args.imageUrl.startsWith("http")) {
      try {
        const imgRes = await fetch(args.imageUrl);
        if (imgRes.ok) {
          const buffer = await imgRes.arrayBuffer();
          const base64 = bufferToBase64(buffer);
          let mimeType = imgRes.headers.get("content-type") || "image/jpeg";
          if (!mimeType.startsWith("image/")) mimeType = "image/jpeg";
          const dataUrl = `data:${mimeType};base64,${base64}`;
          
          let nvidiaKey = process.env.NVIDIA_API_KEY;

          if (nvidiaKey) {
            nvidiaKey = nvidiaKey.replace(/['"]/g, "").trim();
            
            try {
              console.log("Attempting Llama 3.2 90B Vision via NVIDIA...");
              const parsed = await callNvidiaVisionModel(dataUrl, nvidiaKey);
              
              if (parsed && Array.isArray(parsed.garments) && parsed.garments.length > 0) {
                detectedGarments = parsed.garments;
                totalCount = parsed.total_garments || parsed.garments.length;
                aiPlacement = parsed.placement || "indoor";
              }
            } catch (e) {
              console.warn("NVIDIA Llama 3.2 Failed.", e);
            }
          }
        }
      } catch (err) {
        console.warn("Image fetch/processing threw an error:", err);
      }
    }

    const weather = await getLiveWeather(args.lat, args.lon);

    const dryingTimeMinutes = estimateDryingMinutes(
      detectedGarments,
      args.moisture || "medium",
      aiPlacement,
      weather
    );

    const randomFact = LAUNDRY_FUN_FACTS[Math.floor(Math.random() * LAUNDRY_FUN_FACTS.length)];

    return {
      placement: aiPlacement,
      total_garments: totalCount,
      garments: detectedGarments,
      weather,
      drying_time_minutes: dryingTimeMinutes,
      fun_fact: randomFact,
    };
  },
}); 