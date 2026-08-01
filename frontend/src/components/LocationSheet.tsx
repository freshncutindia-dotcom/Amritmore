import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Modal,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { theme } from "@/src/theme";
import { apiFetch } from "@/src/api";
import { useApp } from "@/src/store";

type Serviceable = {
  serviceable: boolean;
  pincode?: string;
  area?: string;
  delivery_fee?: number;
  eta_hours?: number;
  message?: string;
};

export default function LocationSheet({
  visible,
  onClose,
  onPicked,
}: {
  visible: boolean;
  onClose: () => void;
  onPicked?: () => void;
}) {
  const { setLocation, location } = useApp();
  const [pin, setPin] = useState(location?.pincode || "");
  const [busyGps, setBusyGps] = useState(false);
  const [busyCheck, setBusyCheck] = useState(false);
  const [result, setResult] = useState<Serviceable | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const check = useCallback(async (pincode: string) => {
    setErr(null);
    setResult(null);
    if (!/^\d{6}$/.test(pincode)) {
      setErr("Enter a valid 6-digit pincode");
      return null;
    }
    setBusyCheck(true);
    try {
      const res: Serviceable = await apiFetch(`/pincodes/check/${pincode}`);
      setResult(res);
      return res;
    } catch (e: any) {
      setErr(e.message || "Failed to check pincode");
      return null;
    } finally {
      setBusyCheck(false);
    }
  }, []);

  const useGps = useCallback(async () => {
    setErr(null);
    setResult(null);
    setBusyGps(true);
    try {
      let coords: { latitude: number; longitude: number } | null = null;
      if (Platform.OS === "web") {
        // Web fallback: browser geolocation
        coords = await new Promise((resolve, reject) => {
          if (!navigator?.geolocation) return reject(new Error("Geolocation unavailable"));
          navigator.geolocation.getCurrentPosition(
            (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
            (e) => reject(new Error(e.message || "Location permission denied")),
            { timeout: 8000 }
          );
        });
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setErr("Location permission denied. Please enter your PIN manually.");
          setBusyGps(false);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({});
        coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      }
      if (!coords) throw new Error("Could not get location");
      const res: Serviceable = await apiFetch(
        `/geo/reverse-pin?lat=${coords.latitude}&lng=${coords.longitude}`,
      );
      if (res.pincode) {
        setPin(res.pincode);
        setResult({ ...res, serviceable: !!res.serviceable });
      } else {
        setErr(res.message || "We don't deliver to your area yet");
      }
    } catch (e: any) {
      setErr(e.message || "Could not detect your location. Please enter PIN manually.");
    } finally {
      setBusyGps(false);
    }
  }, []);

  const confirm = () => {
    if (!result || !result.serviceable || !result.pincode || !result.area) return;
    setLocation({
      pincode: result.pincode,
      area: result.area,
      delivery_fee: result.delivery_fee ?? 0,
      eta_hours: result.eta_hours ?? 3,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onPicked?.();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
          <Pressable onPress={() => {}}>
            <Animated.View entering={FadeInUp.springify().damping(15)} style={styles.sheet}>
              <View style={styles.grabber} />
              <View style={styles.header}>
                <Ionicons name="location" size={22} color={theme.colors.brand} />
                <Text style={styles.title}>Delivery location</Text>
                <Pressable onPress={onClose} testID="loc-close-btn" style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color={theme.colors.onSurface} />
                </Pressable>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
                <Pressable
                  testID="loc-gps-btn"
                  onPress={useGps}
                  disabled={busyGps}
                  style={[styles.gpsBtn, busyGps && { opacity: 0.6 }]}
                >
                  {busyGps ? (
                    <ActivityIndicator color={theme.colors.brand} />
                  ) : (
                    <Ionicons name="navigate-circle" size={22} color={theme.colors.brand} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gpsTitle}>Use current location</Text>
                    <Text style={styles.gpsSub}>Auto-detect your nearest serviceable pincode</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.onSurfaceMuted} />
                </Pressable>

                <View style={styles.dividerRow}>
                  <View style={styles.hr} />
                  <Text style={styles.orTxt}>or enter PIN manually</Text>
                  <View style={styles.hr} />
                </View>

                <View style={styles.pinField}>
                  <Ionicons name="pin-outline" size={18} color={theme.colors.onSurfaceMuted} />
                  <TextInput
                    testID="loc-pin-input"
                    placeholder="6-digit pincode"
                    placeholderTextColor={theme.colors.onSurfaceMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={pin}
                    onChangeText={(t) => {
                      const v = t.replace(/[^0-9]/g, "");
                      setPin(v);
                      setResult(null);
                      setErr(null);
                      if (v.length === 6) check(v);
                    }}
                    style={styles.pinInput}
                  />
                  {busyCheck && <ActivityIndicator size="small" color={theme.colors.brand} />}
                  {result?.serviceable && (
                    <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
                  )}
                </View>

                {err && <Text style={styles.err}>{err}</Text>}

                {result && (
                  <Animated.View entering={FadeIn} style={styles.resultCard}>
                    {result.serviceable ? (
                      <>
                        <View style={styles.resultRow}>
                          <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.resultTitle}>Delivering to {result.area}</Text>
                            <Text style={styles.resultSub}>PIN {result.pincode}</Text>
                          </View>
                        </View>
                        <View style={styles.pillRow}>
                          <View style={styles.pill}>
                            <Ionicons name="time-outline" size={14} color={theme.colors.brandDark} />
                            <Text style={styles.pillTxt}>~{result.eta_hours}h delivery</Text>
                          </View>
                          <View style={styles.pill}>
                            <Ionicons name="wallet-outline" size={14} color={theme.colors.brandDark} />
                            <Text style={styles.pillTxt}>
                              {result.delivery_fee && result.delivery_fee > 0
                                ? `₹${result.delivery_fee} delivery`
                                : "Free delivery"}
                            </Text>
                          </View>
                        </View>
                      </>
                    ) : (
                      <View style={styles.resultRow}>
                        <Ionicons name="alert-circle" size={20} color={theme.colors.error} />
                        <Text style={styles.resultTitleErr}>
                          {result.message || "Not serviceable in this area yet"}
                        </Text>
                      </View>
                    )}
                  </Animated.View>
                )}

                <Pressable
                  testID="loc-confirm-btn"
                  onPress={confirm}
                  disabled={!result?.serviceable}
                  style={[styles.confirmBtn, !result?.serviceable && { opacity: 0.4 }]}
                >
                  <Text style={styles.confirmTxt}>Confirm & Continue</Text>
                </Pressable>
              </ScrollView>
            </Animated.View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,25,40,0.45)",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
    maxHeight: "80%",
  },
  grabber: {
    width: 44, height: 4, borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: "center", marginBottom: 12,
  },
  header: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 18,
  },
  title: { flex: 1, fontSize: 18, fontWeight: "700", color: theme.colors.onSurface },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: theme.colors.surface3,
    alignItems: "center", justifyContent: "center",
  },
  gpsBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.brandTint,
    borderWidth: 1, borderColor: "rgba(79,163,227,0.35)",
  },
  gpsTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.onSurface },
  gpsSub: { fontSize: 12, color: theme.colors.onSurfaceMuted, marginTop: 2 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 16 },
  hr: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  orTxt: { fontSize: 11, color: theme.colors.onSurfaceMuted },
  pinField: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14, height: 52,
  },
  pinInput: {
    flex: 1, color: theme.colors.onSurface, fontSize: 16,
    letterSpacing: 3,
  },
  err: { color: theme.colors.error, fontSize: 13, textAlign: "center", marginTop: 12 },
  resultCard: {
    marginTop: 14, padding: 14, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  resultTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.onSurface },
  resultTitleErr: { fontSize: 14, fontWeight: "600", color: theme.colors.error, flex: 1 },
  resultSub: { fontSize: 12, color: theme.colors.onSurfaceMuted, marginTop: 2 },
  pillRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: theme.colors.brandTint,
    borderRadius: theme.radius.pill,
  },
  pillTxt: { fontSize: 11, fontWeight: "600", color: theme.colors.brandDark },
  confirmBtn: {
    marginTop: 20, height: 52, borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.brand,
    alignItems: "center", justifyContent: "center",
    ...theme.shadow.md,
  },
  confirmTxt: { color: theme.colors.onBrand, fontWeight: "700", fontSize: 15 },
});
