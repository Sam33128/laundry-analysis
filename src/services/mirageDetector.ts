import { CactusLM } from "cactus-react-native";

export interface DetectedGarment {
  type: string;
  fabric: string;
  color?: string;
}

export interface WeatherContext {
  temperature: number;
  humidity: number;
  wind_speed: number;
  is_day: number;
  cloud_cover: number;
}

export interface LaundryAnalysisResult {
  placement: string;
  total_garments: number;
  garments: DetectedGarment[];
  weather: WeatherContext;
  drying_time_minutes: number;
  fun_fact: string;
}

// Update this slug if cactusLM.getModels() lists a versioned name (e.g. "mirage-v1")
const MIRAGE_MODEL_SLUG = "mirage";

let cactusInstance: CactusLM | null = null;
let isModelDownloaded = false;

const MIRAGE_PROMPT = `Identify every visible clothing item in this image. Do not group identical items; list each piece separately.
Allowed types: t_shirt, shirt, jeans, pants, shorts, dress, skirt, sweater, jacket, underwear, socks, towel, bath_towel, bedsheet, blanket, dupatta, saree, lehenga, kurta, pyjama, scarf, activewear, swimwear.
Allowed fabrics: cotton, denim, polyester, wool, silk, linen, nylon, chiffon, georgette, velvet, terry_cloth, fleece, khadi, blend.
Placement: "indoor" or "outdoor".
Return ONLY raw minified JSON with no markdown:
{"placement":"indoor","total_garments":2,"garments":[{"type":"t_shirt","fabric":"cotton","color":"blue"},{"type":"jeans","fabric":"denim","color":"dark blue"}]}`;

const LAUNDRY_FUN_FACTS = [
  "The average person washes about 400 loads of laundry a year!",
  "Astronauts burn their dirty underwear in the Earth's atmosphere.",
  "The word 'laundry' comes from the Middle English word 'lavendrye'.",
  "Denim was originally designed as durable workwear for miners.",
  "Over-drying clothes breaks down the fabric fibers faster.",
  "The first washing machine was patented in 1691.",
  "Hanging clothes outside in the sun helps naturally bleach and disinfect them.",
  "Washing clothes in cold water saves up to 90% of the energy used by washing machines.",
];

function parseAIJson(rawText: string) {
  const cleanText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
  const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
  if (jsonMatch) return JSON.parse(jsonMatch[0]);
  return JSON.parse(cleanText);
}

async function getLiveWeather(lat?: number, lon?: number): Promise<WeatherContext> {
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
  } catch {
    console.warn("Weather fetch failed, applying default weather");
  }
  return { temperature: 28, humidity: 70, wind_speed: 2, is_day: 1, cloud_cover: 20 };
}

function estimateDryingMinutes(
  garments: DetectedGarment[],
  moisture: string = "medium",
  placement: string = "indoor",
  weather: WeatherContext
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
    if (fabric.includes("denim") || fabric.includes("wool") || fabric.includes("terry") || fabric.includes("fleece")) {
      baseTime *= 1.25;
    } else if (fabric.includes("polyester") || fabric.includes("nylon") || fabric.includes("silk") || fabric.includes("chiffon") || fabric.includes("georgette")) {
      baseTime *= 0.8;
    } else if (fabric.includes("linen") || fabric.includes("khadi")) {
      baseTime *= 0.9;
    }

    if (baseTime > maxItemTime) maxItemTime = baseTime;
  }

  if (maxItemTime === 0) maxItemTime = 40;

  const moistureMultiplier = moisture === "high" ? 1.4 : moisture === "low" ? 0.75 : 1.0;

  let placementMultiplier = 1.0;
  if (placement === "indoor") {
    placementMultiplier = 1.8;
  } else {
    placementMultiplier = weather.is_day === 0 || weather.cloud_cover > 60 ? 1.2 : 0.85;
  }

  const humidityFactor = weather.humidity > 70 ? 1 + ((weather.humidity - 70) / 30) * 1.2 : 0.95;
  const tempFactor = Math.max(0.6, 1 - (weather.temperature - 25) * 0.015);
  const windFactor = Math.max(0.7, 1 - weather.wind_speed * 0.03);
  const crowdingFactor = 1 + Math.max(0, garments.length - 1) * 0.03;

  const calculated =
    maxItemTime *
    crowdingFactor *
    moistureMultiplier *
    placementMultiplier *
    humidityFactor *
    tempFactor *
    windFactor;

  return Math.max(20, Math.round(calculated));
}

async function getMirageInstance(onDownloadProgress?: (progress: number) => void): Promise<CactusLM> {
  if (!cactusInstance) {
    cactusInstance = new CactusLM({ model: MIRAGE_MODEL_SLUG });
  }
  if (!isModelDownloaded) {
    await cactusInstance.download({
      onProgress: (progress: number) => onDownloadProgress?.(progress),
    });
    isModelDownloaded = true;
  }
  return cactusInstance;
}

export async function analyzeLaundryWithMirage(params: {
  imageUri: string;
  moisture: string;
  lat: number;
  lon: number;
  onDownloadProgress?: (progress: number) => void;
}): Promise<LaundryAnalysisResult> {
  let detectedGarments: DetectedGarment[] = [{ type: "unknown", fabric: "unknown", color: "unknown" }];
  let totalCount = 1;
  let aiPlacement = "indoor";

  const lm = await getMirageInstance(params.onDownloadProgress);
  const localPath = params.imageUri.replace(/^file:\/\//, "");

  try {
    const completion = await lm.complete({
      messages: [
        {
          role: "user",
          content: MIRAGE_PROMPT,
          images: [localPath],
        },
      ],
    });

    const rawOutput = completion?.response || "";
    const parsed = parseAIJson(rawOutput);

    if (parsed && Array.isArray(parsed.garments) && parsed.garments.length > 0) {
      detectedGarments = parsed.garments;
      totalCount = parsed.total_garments || parsed.garments.length;
      aiPlacement = parsed.placement || "indoor";
    }
  } catch (err) {
    console.warn("Mirage inference/parsing error:", err);
    throw new Error("Local Mirage model failed to analyze the image.");
  } finally {
    await lm.reset().catch(() => {});
  }

  const weather = await getLiveWeather(params.lat, params.lon);
  const dryingTimeMinutes = estimateDryingMinutes(
    detectedGarments,
    params.moisture || "medium",
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
}

export async function releaseMirageModel() {
  if (cactusInstance) {
    await cactusInstance.destroy().catch(() => {});
    cactusInstance = null;
  }
} 