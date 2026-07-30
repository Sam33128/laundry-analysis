import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";

export default function App() {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const saveImage = useMutation(api.files.saveImage);

  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  async function handleUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);

    try {
      // Get upload URL from Convex
      const postUrl = await generateUploadUrl();

      // Upload image
      const result = await fetch(postUrl, {
        method: "POST",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      const { storageId } = await result.json();

      // Save metadata
      const url = await saveImage({
  imageId: storageId,
});

setImageUrl(url);
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    }

    setUploading(false);
  }

  function copyUrl() {
    navigator.clipboard.writeText(imageUrl);
    alert("Image URL copied!");
  }

  return (
    <div
      style={{
        maxWidth: 600,
        margin: "40px auto",
        textAlign: "center",
        fontFamily: "Arial",
      }}
    >
      <h1>Laundry Image Upload</h1>

      <input
        type="file"
        accept="image/*"
        onChange={handleUpload}
      />

      <br />
      <br />

      {uploading && <p>Uploading...</p>}

      {imageUrl && (
        <>
          <img
            src={imageUrl}
            alt="Uploaded"
            width="300"
            style={{ borderRadius: "10px" }}
          />

          <p>{imageUrl}</p>

          <button onClick={copyUrl}>
            Copy URL
          </button>
        </>
      )}
    </div>
  );
} 