import { ConvexReactClient } from "convex/react";
import { ConvexProvider } from "convex/react";
import { Stack } from "expo-router";

const convex = new ConvexReactClient(
  "https://courteous-anaconda-947.convex.cloud"
);

export default function RootLayout() {
  return (
    <ConvexProvider client={convex}>
      <Stack />
    </ConvexProvider>
  );
} 