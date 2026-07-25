import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AppProvider } from "@/src/store";

LogBox.ignoreAllLogs(true);

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <StatusBar barStyle="dark-content" backgroundColor="#FDFBF7" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FDFBF7" } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="auth" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="product/[id]" options={{ presentation: "card", animation: "slide_from_right" }} />
            <Stack.Screen name="checkout" options={{ animation: "slide_from_bottom" }} />
            <Stack.Screen name="admin" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="orders" options={{ animation: "slide_from_right" }} />
          </Stack>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
