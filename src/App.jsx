import { useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";

export default function App() {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const saveImage = useMutation(api.files.saveImage);
  const analyzeImage = useAction(api.analyzeImage.analyzeImage);
  
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  const [result, setResult] = useState(null);

  // 🔹 user inputs
  const [moisture, setMoisture] = useState("medium");
  const [sun, setSun] = useState("medium");
  const [placement, setPlacement] = useState("outdoor_sun");

  // ---------------- UPLOAD ----------------
  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const postUrl = await generateUploadUrl();

      const uploadRes = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      const { storageId } = await uploadRes.json();

      const url = await saveImage({ imageId: storageId });

      setImageUrl(url);
      setResult(null);
    } catch (err) {
      console.error(err);
      setError("Upload failed");
    }

    setUploading(false);
  }

  // ---------------- ANALYZE ----------------
  async function handleAnalyze() {
    if (!imageUrl) {
      setError("Upload image first");
      return;
    }

    setAnalyzing(true);
    setError("");

    try {
      const payload = {
        imageUrl,
        moisture,
        sun,
        placement,
      };

      const res = await analyzeImage(payload);

      if (res.error) {
        setError(res.error);
      }

      setResult(res);
    } catch (err) {
      console.error(err);
      setError("Analysis failed");
    }

    setAnalyzing(false);
  }

  // ---------------- UI ----------------
  return (
    <div style={{ maxWidth: 600, margin: "40px auto", textAlign: "center" }}>
      <h1>Laundry Analyzer</h1>

      <input type="file" accept="image/*" onChange={handleUpload} />

      <br /><br />

      {/* -------- USER INPUTS -------- */}
      <div style={{ textAlign: "left", marginBottom: 20 }}>
        <h3>Conditions</h3>

        <label>Moisture:</label>
        <select value={moisture} onChange={(e) => setMoisture(e.target.value)}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>

        <br /><br />

        <label>Sun Exposure:</label>
        <select value={sun} onChange={(e) => setSun(e.target.value)}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>

        <br /><br />

        <label>Placement:</label>
        <select value={placement} onChange={(e) => setPlacement(e.target.value)}>
          <option value="indoor_closed">Indoor Closed</option>
          <option value="indoor_ventilated">Indoor Ventilated</option>
          <option value="outdoor_shade">Outdoor Shade</option>
          <option value="outdoor_sun">Outdoor Sun</option>
        </select>
      </div>

      {/* -------- STATES -------- */}
      {uploading && <p>Uploading...</p>}
      {analyzing && <p>Analyzing...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* -------- IMAGE -------- */}
      {imageUrl && (
        <>
          <img src={imageUrl} width="300" style={{ borderRadius: 10 }} />
          <p>{imageUrl}</p>

          <button onClick={handleAnalyze} disabled={analyzing}>
            Analyze
          </button>
        </>
      )}

      {/* -------- RESULT -------- */}
      {result && !result.error && (
        <div style={{ marginTop: 20, textAlign: "left" }}>
          <h3>Result</h3>

          <p style={{ fontSize: 18, fontWeight: "bold", color: "green" }}>
            Estimated Drying Time: {result.drying_time_minutes} minutes
          </p>

          <p><b>Total Garments:</b> {result.total_garments}</p>

          {result.garments?.map((g, i) => (
            <div key={i}>
              <p>Type: {g.type}</p>
              <p>Fabric: {g.fabric}</p>
            </div>
          ))}

          {result.weather && (
            <div style={{ marginTop: 15, padding: 10, border: "1px solid #ccc" }}>
              <h4>Weather</h4>
              <p><b>Temp:</b> {result.weather.temperature}°C</p>
              <p><b>Humidity:</b> {result.weather.humidity}%</p>
              <p><b>Wind:</b> {result.weather.wind_speed}</p>
            </div>
          )}

          {/* DEBUG */}
          <details>
            <summary>Raw JSON</summary>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
} 