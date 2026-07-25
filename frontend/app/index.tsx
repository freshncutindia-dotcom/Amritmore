import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

import { useApp } from "@/src/store";
import { theme } from "@/src/theme";

export default function Index() {
  const { ready, user } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    // Everyone can browse - route to tabs. Auth is required only for checkout.
    router.replace("/(tabs)");
  }, [ready, user, router]);

  return (
    <View style={styles.center} testID="splash-loader">
      <ActivityIndicator size="large" color={theme.colors.brand} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surface },
});
