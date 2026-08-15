import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { theme } from "@/src/theme";
import { useApp } from "@/src/store";

export default function Auth() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ redirect?: string; pincode?: string; delivery_fee?: string }>();
  const { login, register } = useApp();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!email || !password || (mode === "register" && !name)) {
      setErr("Please fill in all fields");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(name, email, password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (params.redirect === "/checkout") {
        router.replace({ pathname: "/checkout", params: { pincode: params.pincode, delivery_fee: params.delivery_fee } });
      } else {
        router.replace("/(tabs)");
      }
    } catch (e: any) {
      setErr(e.message || "Something went wrong");
    } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: theme.spacing.xl, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.onSurface} />
        </Pressable>

        <View style={styles.logoWrap}>
          <Image source={require("../assets/images/logo.webp")} style={styles.logoImg} contentFit="contain" />
        </View>
        <Text style={styles.h1}>{mode === "login" ? "Welcome back" : "Create your account"}</Text>
        <Text style={styles.sub}>{mode === "login" ? "Sign in to place & track orders" : "Fresh farm produce, minutes away"}</Text>

        <Animated.View entering={FadeIn} style={{ marginTop: 30, gap: 12 }}>
          {mode === "register" && (
            <View style={styles.field}>
              <Ionicons name="person-outline" size={18} color={theme.colors.onSurfaceMuted} />
              <TextInput
                testID="auth-name-input"
                placeholder="Full name"
                placeholderTextColor={theme.colors.onSurfaceMuted}
                style={styles.input}
                value={name}
                onChangeText={setName}
              />
            </View>
          )}
          <View style={styles.field}>
            <Ionicons name="mail-outline" size={18} color={theme.colors.onSurfaceMuted} />
            <TextInput
              testID="auth-email-input"
              placeholder="Email address"
              placeholderTextColor={theme.colors.onSurfaceMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            />
          </View>
          <View style={styles.field}>
            <Ionicons name="lock-closed-outline" size={18} color={theme.colors.onSurfaceMuted} />
            <TextInput
              testID="auth-password-input"
              placeholder="Password"
              placeholderTextColor={theme.colors.onSurfaceMuted}
              secureTextEntry
              style={styles.input}
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {err && <Text style={styles.err}>{err}</Text>}

          <Pressable testID="auth-submit-btn" onPress={submit} disabled={busy} style={[styles.btn, busy && { opacity: 0.6 }]}>
            <Text style={styles.btnTxt}>{busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}</Text>
          </Pressable>

          <Pressable testID="auth-toggle-btn" onPress={() => { setMode(mode === "login" ? "register" : "login"); setErr(null); }} style={{ alignItems: "center", padding: 12 }}>
            <Text style={styles.toggle}>
              {mode === "login" ? "New here? " : "Already have an account? "}
              <Text style={{ color: theme.colors.brand, fontWeight: "700" }}>{mode === "login" ? "Create account" : "Sign in"}</Text>
            </Text>
          </Pressable>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 22 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
            <Text style={{ color: theme.colors.onSurfaceMuted, fontSize: 12 }}>or</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
          </View>

          <Pressable
            testID="auth-mobile-btn"
            onPress={() => router.replace("/otp")}
            style={{
              marginTop: 14, height: 50, borderRadius: theme.radius.pill,
              borderWidth: 1.5, borderColor: theme.colors.brand,
              backgroundColor: "rgba(255,255,255,0.6)",
              flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <Ionicons name="phone-portrait-outline" size={18} color={theme.colors.brandDark} />
            <Text style={{ color: theme.colors.brandDark, fontWeight: "700", fontSize: 14 }}>Sign in with mobile OTP</Text>
          </Pressable>

          <Pressable
            testID="auth-guest-btn"
            onPress={() => router.replace("/(tabs)")}
            style={{ alignItems: "center", padding: 14, marginTop: 4 }}
          >
            <Text style={{ color: theme.colors.onSurfaceMuted, fontSize: 13 }}>
              or <Text style={{ color: theme.colors.brand, fontWeight: "700" }}>continue as guest</Text>
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surface2, marginBottom: 20, ...theme.shadow.sm },
  logoWrap: { alignItems: "center", marginBottom: 24 },
  logoImg: { width: 220, height: 90 },
  h1: { fontSize: 30, fontWeight: "700", color: theme.colors.onSurface },
  sub: { fontSize: 14, color: theme.colors.onSurfaceMuted, marginTop: 6 },
  field: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 14, height: 52 },
  input: { flex: 1, color: theme.colors.onSurface, fontSize: 14 },
  btn: { marginTop: 8, height: 52, borderRadius: theme.radius.pill, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center", ...theme.shadow.md },
  btnTxt: { color: theme.colors.onBrand, fontWeight: "700", fontSize: 15 },
  err: { color: theme.colors.error, fontSize: 13, textAlign: "center" },
  toggle: { color: theme.colors.onSurfaceMuted, fontSize: 13 },
});
