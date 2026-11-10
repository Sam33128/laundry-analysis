import { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';
import * as SecureStore from 'expo-secure-store';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

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
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    // Hide the native splash to show our custom white screen with text
    SplashScreen.hideAsync().catch(() => {});
    
    const timer = setTimeout(() => {
      setAppReady(true);
    }, 2000); // Shows the white splash for 2 seconds
    return () => clearTimeout(timer);
  }, []);

  if (!appReady) {
    return (
      <View style={styles.splashContainer}>
        <Image 
          source={require('../../assets/images/icon.png')} 
          style={styles.logo} 
          resizeMode="contain" 
        />
        <Text style={styles.title}>Laundry Analysis</Text>
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
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#090d16',
    letterSpacing: 1,
  }
}); 