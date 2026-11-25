import { ClerkProvider, useAuth } from '@clerk/expo';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';
import * as SecureStore from 'expo-secure-store';
import { Stack } from 'expo-router';

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL || "https://rapid-goat-745.convex.cloud";
const convex = new ConvexReactClient(convexUrl, { unsavedChangesWarning: false });

const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      await SecureStore.deleteItemAsync(key);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
};

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || "pk_test_YXBwYXJlbnQtcHVnLTM4MDguY2xlcmsuYWNjb3VudHMuZGV2JA";

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#090d16' } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen 
            name="upload" 
            options={{ 
              presentation: 'modal', 
              title: 'Create Session', 
              headerShown: true,
              headerStyle: { backgroundColor: '#090d16' },
              headerTintColor: '#fff'
            }} 
          />
        </Stack>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
} 