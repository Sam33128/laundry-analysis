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

  const [moisture, setMoisture] = useState("medium");
  const [sun, setSun] = useState("medium");
  const [placement, setPlacement] = useState("outdoor_sun");

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

  async function handleAnalyze() {
    if (!imageUrl) {
      setError("Upload image first");
      return;
    }

    setAnalyzing(true);
    setError("");

    try {
      const res = await analyzeImage({
        imageUrl,
        moisture,
        sun,
        placement,
      });

      if (res.error) setError(res.error);
      setResult(res);
    } catch (err) {
      console.error(err);
      setError("Analysis failed");
    }

    setAnalyzing(false);
  }

  return (
    <div
      style={{
        maxWidth: 700,
        margin: "40px auto",
        padding: "20px",
        background: "#111",
        borderRadius: "12px",
        color: "#fff",
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ marginBottom: 20 }}>Laundry Analyzer 🌤️</h1>

      {/* Upload */}
      <input type="file" accept="image/*" onChange={handleUpload} />

      <br /><br />

      {/* Conditions */}
      <div
        style={{
          background: "#1c1c1c",
          padding: "15px",
          borderRadius: "10px",
          marginBottom: "20px",
          textAlign: "left",
        }}
      >
        <h3>Conditions</h3>

        <label>Moisture:</label><br />
        <select value={moisture} onChange={(e) => setMoisture(e.target.value)}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>

        <br /><br />

        <label>Sun Exposure:</label><br />
        <select value={sun} onChange={(e) => setSun(e.target.value)}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>

        <br /><br />

        <label>Placement:</label><br />
        <select value={placement} onChange={(e) => setPlacement(e.target.value)}>
          <option value="indoor_closed">Indoor Closed</option>
          <option value="indoor_ventilated">Indoor Ventilated</option>
          <option value="outdoor_shade">Outdoor Shade</option>
          <option value="outdoor_sun">Outdoor Sun</option>
        </select>
      </div>

      {/* States */}
      {uploading && <p>Uploading...</p>}
      {analyzing && <p>Analyzing...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* Image + Button */}
      {imageUrl && (
        <>
          <img
            src={imageUrl}
            width="300"
            style={{ borderRadius: 10, marginBottom: 10 }}
          />
          <p style={{ fontSize: "12px", color: "#aaa" }}>{imageUrl}</p>

          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            style={{
              padding: "10px 20px",
              backgroundColor: analyzing ? "#666" : "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: analyzing ? "not-allowed" : "pointer",
              marginTop: "10px",
            }}
          >
            {analyzing ? "Analyzing..." : "Analyze Image"}
          </button>
        </>
      )}

      {/* Result */}
      {result && !result.error && (
        <div
          style={{
            marginTop: 25,
            background: "#1c1c1c",
            padding: "15px",
            borderRadius: "10px",
            textAlign: "left",
          }}
        >
          <h3>Result</h3>

          <p style={{ fontSize: 18, fontWeight: "bold", color: "#4CAF50" }}>
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
            <div
              style={{
                marginTop: 15,
                padding: 10,
                border: "1px solid #333",
                borderRadius: "6px",
              }}
            >
              <h4>Weather</h4>
              <p><b>Temp:</b> {result.weather.temperature}°C</p>
              <p><b>Humidity:</b> {result.weather.humidity}%</p>
              <p><b>Wind:</b> {result.weather.wind_speed}</p>
            </div>
          )}

          <details>
            <summary>Raw JSON</summary>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
} 