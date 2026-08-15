import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { theme } from "@/src/theme";
import { useApp } from "@/src/store";

type Step = "mobile" | "otp";

export default function OtpAuth() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ redirect?: string }>();
  const { sendOtp, verifyOtp } = useApp();

  const [step, setStep] = useState<Step>("mobile");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [requestId, setRequestId] = useState("");
  const [devCode, setDevCode] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const validMobile = /^[6-9]\d{9}$/.test(mobile.trim());

  const doSend = async () => {
    if (!validMobile) {
      setErr("Enter a valid 10-digit Indian mobile number");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const { request_id } = await sendOtp("+91" + mobile.trim());
      setRequestId(request_id);
      setDevCode("123456"); // mock hint — real SMS provider pending
      setStep("otp");
      setResendIn(30);
      Haptics.selectionAsync();
    } catch (e: any) {
      setErr(e.message || "Failed to send OTP");
    } finally {
      setBusy(false);
    }
  };

  const doVerify = async () => {
    if (otp.length !== 6) {
      setErr("Enter the 6-digit code");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      await verifyOtp("+91" + mobile.trim(), otp, requestId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(params.redirect ? { pathname: params.redirect as any } : "/(tabs)");
    } catch (e: any) {
      setErr(e.message || "Invalid OTP");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: theme.spacing.xl, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          testID="otp-back-btn"
          onPress={() => (step === "otp" ? setStep("mobile") : router.back())}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={22} color={theme.colors.onSurface} />
        </Pressable>

        <View style={styles.logoWrap}>
          <Image source={require("../assets/images/logo.webp")} style={styles.logoImg} contentFit="contain" />
        </View>

        {step === "mobile" ? (
          <Animated.View entering={FadeIn} key="mobile-step">
            <Text style={styles.h1}>Welcome to FreshncuT 🌿</Text>
            <Text style={styles.sub}>Enter your mobile number to continue</Text>

            <View style={[styles.field, { marginTop: 30 }]}>
              <Text style={styles.prefix}>🇮🇳 +91</Text>
              <View style={styles.divider} />
              <TextInput
                testID="otp-mobile-input"
                autoFocus
                placeholder="98765 43210"
                placeholderTextColor={theme.colors.onSurfaceMuted}
                keyboardType="phone-pad"
                maxLength={10}
                value={mobile}
                onChangeText={(t) => setMobile(t.replace(/[^0-9]/g, ""))}
                style={styles.input}
              />
              {validMobile && (
                <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
              )}
            </View>

            {err && <Text style={styles.err}>{err}</Text>}

            <Pressable
              testID="otp-send-btn"
              onPress={doSend}
              disabled={busy || !validMobile}
              style={[styles.btn, (busy || !validMobile) && { opacity: 0.5 }]}
            >
              {busy ? (
                <ActivityIndicator color={theme.colors.onBrand} />
              ) : (
                <Text style={styles.btnTxt}>Get OTP</Text>
              )}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.hr} />
              <Text style={styles.orTxt}>or</Text>
              <View style={styles.hr} />
            </View>

            <Pressable
              testID="otp-guest-btn"
              onPress={() => router.replace("/(tabs)")}
              style={styles.guestBtn}
            >
              <Ionicons name="eye-outline" size={18} color={theme.colors.brandDark} />
              <Text style={styles.guestTxt}>Continue as guest</Text>
            </Pressable>

            <Pressable
              testID="otp-email-link"
              onPress={() => router.replace("/auth")}
              style={{ alignItems: "center", marginTop: 18 }}
            >
              <Text style={styles.linkTxt}>
                Prefer email? <Text style={{ color: theme.colors.brand, fontWeight: "700" }}>Sign in with email</Text>
              </Text>
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInUp} key="otp-step">
            <Text style={styles.h1}>Verify your number</Text>
            <Text style={styles.sub}>
              We've sent a 6-digit code to <Text style={{ fontWeight: "700" }}>+91 {mobile}</Text>
            </Text>

            <View style={[styles.field, { marginTop: 30 }]}>
              <Ionicons name="lock-closed-outline" size={18} color={theme.colors.onSurfaceMuted} />
              <TextInput
                testID="otp-code-input"
                autoFocus
                placeholder="123456"
                placeholderTextColor={theme.colors.onSurfaceMuted}
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/[^0-9]/g, ""))}
                style={[styles.input, { letterSpacing: 6, fontSize: 20, textAlign: "center" }]}
              />
            </View>

            {devCode && (
              <View style={styles.devHint}>
                <Ionicons name="information-circle-outline" size={16} color={theme.colors.brandDark} />
                <Text style={styles.devHintTxt}>
                  Dev mode — use code <Text style={{ fontWeight: "700" }}>{devCode}</Text>
                </Text>
              </View>
            )}

            {err && <Text style={styles.err}>{err}</Text>}

            <Pressable
              testID="otp-verify-btn"
              onPress={doVerify}
              disabled={busy || otp.length !== 6}
              style={[styles.btn, (busy || otp.length !== 6) && { opacity: 0.5 }]}
            >
              {busy ? <ActivityIndicator color={theme.colors.onBrand} /> : <Text style={styles.btnTxt}>Verify & Continue</Text>}
            </Pressable>

            <Pressable
              testID="otp-resend-btn"
              disabled={resendIn > 0 || busy}
              onPress={doSend}
              style={{ alignItems: "center", marginTop: 18, opacity: resendIn > 0 ? 0.5 : 1 }}
            >
              <Text style={styles.linkTxt}>
                {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  back: {
    width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.7)", marginBottom: 20, ...theme.shadow.sm,
  },
  logoWrap: { alignItems: "center", marginBottom: 24 },
  logoImg: { width: 220, height: 90 },
  h1: { fontSize: 28, fontWeight: "700", color: theme.colors.onSurface, textAlign: "center" },
  sub: { fontSize: 14, color: theme.colors.onSurfaceMuted, marginTop: 8, textAlign: "center", lineHeight: 20 },
  field: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1, borderColor: "rgba(79,163,227,0.35)",
    borderRadius: theme.radius.md, paddingHorizontal: 14, height: 56,
    ...theme.shadow.sm,
  },
  prefix: { fontSize: 16, fontWeight: "600", color: theme.colors.onSurface },
  divider: { width: 1, height: 24, backgroundColor: theme.colors.border },
  input: { flex: 1, color: theme.colors.onSurface, fontSize: 16 },
  btn: {
    marginTop: 20, height: 54, borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center",
    ...theme.shadow.md,
  },
  btnTxt: { color: theme.colors.onBrand, fontWeight: "700", fontSize: 15, letterSpacing: 0.3 },
  err: { color: theme.colors.error, fontSize: 13, textAlign: "center", marginTop: 12 },
  dividerRow: { flexDirection: "row", alignItems: "center", marginTop: 26, gap: 12 },
  hr: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  orTxt: { color: theme.colors.onSurfaceMuted, fontSize: 12 },
  guestBtn: {
    marginTop: 18, height: 52, borderRadius: theme.radius.pill,
    borderWidth: 1.5, borderColor: theme.colors.brand,
    backgroundColor: "rgba(255,255,255,0.6)",
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  guestTxt: { color: theme.colors.brandDark, fontWeight: "700", fontSize: 14 },
  linkTxt: { color: theme.colors.onSurfaceMuted, fontSize: 13 },
  devHint: {
    marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: theme.colors.brandTint, padding: 10, borderRadius: theme.radius.sm,
  },
  devHintTxt: { fontSize: 12, color: theme.colors.brandDark, flex: 1 },
});
