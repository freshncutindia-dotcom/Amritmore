import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, StatusBar, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, DefaultTheme } from "@react-navigation/native";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AppProvider } from "@/src/store";
import { DrawerProvider } from "@/src/components/SideDrawer";
import BackgroundAurora from "@/src/components/BackgroundAurora";

LogBox.ignoreAllLogs(true);

SplashScreen.preventAutoHideAsync();

const TransparentNavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "transparent",
    card: "transparent",
  },
};

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
          <DrawerProvider>
            <View style={{ flex: 1, backgroundColor: "#EAF4FE" }}>
              <BackgroundAurora />
              <StatusBar barStyle="dark-content" backgroundColor="#EAF4FE" />
              <ThemeProvider value={TransparentNavTheme}>
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="auth" />
                  <Stack.Screen name="otp" options={{ animation: "slide_from_right" }} />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="product/[id]" options={{ presentation: "card", animation: "slide_from_right" }} />
                  <Stack.Screen name="checkout" options={{ animation: "slide_from_bottom" }} />
                  <Stack.Screen name="addresses" options={{ animation: "slide_from_right" }} />
                  <Stack.Screen name="admin" options={{ animation: "slide_from_right" }} />
                  <Stack.Screen name="orders" options={{ animation: "slide_from_right" }} />
                  <Stack.Screen name="subscribe" options={{ animation: "slide_from_right" }} />
                </Stack>
              </ThemeProvider>
            </View>
          </DrawerProvider>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
