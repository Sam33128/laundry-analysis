import { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';
import * as SecureStore from 'expo-secure-store';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Video, ResizeMode } from 'expo-av';

SplashScreen.preventAutoHideAsync();

const convex = new ConvexReactClient(
  process.env.EXPO_PUBLIC_CONVEX_URL!,
  { unsavedChangesWarning: false }
);

const tokenCache = {
  async getToken(key: string) {
    try { return await SecureStore.getItemAsync(key); } catch (err) { return null; }
  },
  async saveToken(key: string, value: string) {
    try { await SecureStore.setItemAsync(key, value); } catch (err) { return; }
  },
};

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

export default function RootLayout() {
  const [videoFinished, setVideoFinished] = useState(false);

  // SAFETY NET: Force the app to open after 4 seconds even if the video lags
  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
      setVideoFinished(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  if (!videoFinished) {
    return (
      <View style={styles.splashContainer}>
        <Video
          source={require('../../assets/splash-video.mp4')}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping={false}
          onReadyForDisplay={() => {
            SplashScreen.hideAsync().catch(() => {});
          }}
          onPlaybackStatusUpdate={(status) => {
            if (status.isLoaded && status.didJustFinish) {
              setVideoFinished(true);
            }
          }}
          onError={(error) => {
            // If the video fails to load, open the app immediately
            console.warn("Video failed to load", error);
            SplashScreen.hideAsync().catch(() => {});
            setVideoFinished(true);
          }}
        />
      </View>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#090d16',
  }
}); 