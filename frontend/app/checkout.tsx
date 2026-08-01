import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { theme } from "@/src/theme";
import { apiFetch } from "@/src/api";
import { useApp } from "@/src/store";
import type { Address } from "./addresses";

type Slot = { id: string; label: string; sub: string; date: string; fee: number; type: string; icon: string };

const LABEL_META = {
  home: { icon: "home", txt: "Home" as const },
  office: { icon: "briefcase", txt: "Office" as const },
  other: { icon: "location", txt: "Other" as const },
};

export default function Checkout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ address_id?: string }>();
  const { cart, cartTotal, clearCart, user, location } = useApp();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [handlingFee, setHandlingFee] = useState(9);
  const [selectedAddr, setSelectedAddr] = useState<Address | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<null | { id: string }>(null);

  // Payment: COD only for now (Razorpay disabled until keys provided)
  const paymentMethod: "cod" = "cod";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [addrs, slotsData]: [Address[], { slots: Slot[]; handling_fee: number }] = await Promise.all([
        user ? apiFetch("/addresses") : Promise.resolve([]),
        apiFetch("/delivery/slots"),
      ]);
      setAddresses(addrs);
      setSlots(slotsData.slots || []);
      setHandlingFee(slotsData.handling_fee ?? 9);

      // Preselect: incoming param > default > first
      const chosen =
        (params.address_id && addrs.find((a) => a.id === params.address_id)) ||
        addrs.find((a) => a.is_default) ||
        addrs[0] ||
        null;
      setSelectedAddr(chosen);

      // Preselect: express if present
      const defSlot = slotsData.slots?.find((s) => s.type === "express") || slotsData.slots?.[0] || null;
      setSelectedSlot(defSlot);
    } finally {
      setLoading(false);
    }
  }, [user, params.address_id]);

  useEffect(() => { load(); }, [load]);

  const deliveryFee = selectedSlot?.fee ?? 0;
  const total = useMemo(() => cartTotal + deliveryFee + handlingFee, [cartTotal, deliveryFee, handlingFee]);

  const place = async () => {
    if (!user) {
      router.push("/otp");
      return;
    }
    if (!selectedAddr) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    if (!selectedSlot) return;
    setPlacing(true);
    try {
      const order = await apiFetch("/orders", {
        method: "POST",
        body: JSON.stringify({
          items: cart,
          address: `${selectedAddr.name}, ${selectedAddr.line1}${selectedAddr.line2 ? ", " + selectedAddr.line2 : ""}, ${selectedAddr.area}`,
          pincode: selectedAddr.pincode,
          phone: selectedAddr.mobile,
          payment_method: paymentMethod,
          delivery_fee: deliveryFee,
          handling_fee: handlingFee,
          subtotal: cartTotal,
          total,
          address_id: selectedAddr.id,
          delivery_slot_id: selectedSlot.id,
          delivery_slot_label: selectedSlot.label,
        }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPlaced({ id: order.id });
      clearCart();
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.log("checkout err", e);
    } finally {
      setPlacing(false);
    }
  };

  if (placed) {
    return (
      <View style={[styles.successWrap, { paddingTop: insets.top + 40 }]}>
        <Animated.View entering={FadeInDown} style={styles.checkCircle}>
          <Ionicons name="checkmark" size={54} color="#fff" />
        </Animated.View>
        <Animated.Text entering={FadeIn.delay(200)} style={styles.successH1}>Order placed! 🎉</Animated.Text>
        <Animated.Text entering={FadeIn.delay(300)} style={styles.successSub}>
          {selectedSlot?.label} · Cash on Delivery
        </Animated.Text>
        <Animated.Text entering={FadeIn.delay(400)} style={styles.successId}>Order #{placed.id.slice(0, 8).toUpperCase()}</Animated.Text>
        <Pressable testID="success-home-btn" style={styles.successBtn} onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.successBtnTxt}>Back to home</Text>
        </Pressable>
        <Pressable testID="success-orders-btn" style={styles.linkBtn} onPress={() => router.replace("/orders")}>
          <Text style={{ color: theme.colors.brand, fontWeight: "600" }}>View my orders</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.onSurface} />
        </Pressable>
        <Text style={styles.htitle}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.brand} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 200 }}>
          {/* --- Address section --- */}
          <View style={styles.sectionHead}>
            <Text style={styles.section}>Deliver to</Text>
            <Pressable
              testID="ck-manage-addr"
              onPress={() => router.push({ pathname: "/addresses", params: { pick: "1" } })}
            >
              <Text style={styles.link}>{addresses.length ? "Change" : "Add new"}</Text>
            </Pressable>
          </View>

          {selectedAddr ? (
            <Pressable
              testID="ck-selected-addr"
              onPress={() => router.push({ pathname: "/addresses", params: { pick: "1" } })}
              style={styles.card}
            >
              <View style={styles.addrTop}>
                <View style={styles.labelPill}>
                  <Ionicons name={LABEL_META[selectedAddr.label].icon as any} size={12} color={theme.colors.brandDark} />
                  <Text style={styles.labelTxt}>{LABEL_META[selectedAddr.label].txt}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.onSurfaceMuted} />
              </View>
              <Text style={styles.addrName}>{selectedAddr.name} · {selectedAddr.mobile}</Text>
              <Text style={styles.addrLine}>
                {selectedAddr.line1}
                {selectedAddr.line2 ? `, ${selectedAddr.line2}` : ""}, {selectedAddr.area} – {selectedAddr.pincode}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              testID="ck-add-addr"
              onPress={() => router.push({ pathname: "/addresses" })}
              style={[styles.card, { flexDirection: "row", alignItems: "center", gap: 10 }]}
            >
              <Ionicons name="add-circle" size={22} color={theme.colors.brand} />
              <Text style={{ color: theme.colors.brand, fontWeight: "700" }}>
                {user ? "Add delivery address" : "Sign in to save address"}
              </Text>
            </Pressable>
          )}

          {/* --- Delivery slot --- */}
          <Text style={styles.section}>Delivery slot</Text>
          <View style={{ gap: 8 }}>
            {slots.map((s, i) => (
              <Animated.View key={s.id} entering={FadeInDown.delay(i * 30)}>
                <Pressable
                  testID={`ck-slot-${s.id}`}
                  onPress={() => setSelectedSlot(s)}
                  style={[styles.slotCard, selectedSlot?.id === s.id && styles.slotActive]}
                >
                  <View style={[styles.slotIcon, s.type === "express" && { backgroundColor: "#FFE9C7" }]}>
                    <Ionicons
                      name={s.icon as any}
                      size={18}
                      color={s.type === "express" ? "#E38A1B" : theme.colors.brand}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={styles.slotLabel}>{s.label}</Text>
                      {s.type === "express" && (
                        <View style={styles.fastPill}>
                          <Text style={styles.fastTxt}>FASTEST</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.slotSub}>{s.sub}</Text>
                  </View>
                  <Text style={styles.slotFee}>₹{s.fee}</Text>
                  {selectedSlot?.id === s.id && (
                    <Ionicons name="checkmark-circle" size={20} color={theme.colors.brand} style={{ marginLeft: 6 }} />
                  )}
                </Pressable>
              </Animated.View>
            ))}
          </View>

          {/* --- Payment method --- */}
          <Text style={styles.section}>Payment method</Text>
          <View style={styles.card}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={styles.payIcon}>
                <Ionicons name="cash-outline" size={22} color={theme.colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.payName}>Cash on Delivery</Text>
                <Text style={styles.paySub}>Pay when you receive · verified</Text>
              </View>
              <Ionicons name="checkmark-circle" size={22} color={theme.colors.brand} />
            </View>
            <View style={styles.divider} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="information-circle-outline" size={16} color={theme.colors.onSurfaceMuted} />
              <Text style={styles.disabledInfo}>
                UPI / Cards / Wallets · <Text style={{ fontStyle: "italic" }}>coming soon</Text>
              </Text>
            </View>
          </View>

          {/* --- Order summary with transparent pricing --- */}
          <Text style={styles.section}>Order summary ({cart.length} item{cart.length === 1 ? "" : "s"})</Text>
          <View style={styles.card}>
            {cart.map((i) => (
              <View key={`${i.product_id}-${i.cut_type}-${i.unit}`} style={styles.sumRow}>
                <Text style={styles.sumName} numberOfLines={1}>
                  {i.name} <Text style={{ color: theme.colors.onSurfaceMuted }}>({i.cut_type}) × {i.quantity}</Text>
                </Text>
                <Text style={styles.sumVal}>₹{(i.price * i.quantity).toFixed(0)}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.sumRow}>
              <Text style={styles.sumName}>Item total</Text>
              <Text style={styles.sumVal}>₹{cartTotal.toFixed(0)}</Text>
            </View>
            <View style={styles.sumRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={styles.sumName}>Delivery</Text>
                {selectedSlot?.type === "express" && <Text style={styles.subMuted}>· express</Text>}
              </View>
              <Text style={styles.sumVal}>{deliveryFee ? `₹${deliveryFee}` : "Free"}</Text>
            </View>
            <View style={styles.sumRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={styles.sumName}>Handling & packing</Text>
                <Ionicons name="help-circle-outline" size={12} color={theme.colors.onSurfaceMuted} />
              </View>
              <Text style={styles.sumVal}>₹{handlingFee}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.sumRow}>
              <Text style={styles.totalName}>Total</Text>
              <Text style={styles.totalVal}>₹{total.toFixed(0)}</Text>
            </View>
          </View>
        </ScrollView>
      )}

      <View style={[styles.stickyCta, { paddingBottom: insets.bottom + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.stickyLabel}>Total ({cart.length} item{cart.length === 1 ? "" : "s"})</Text>
          <Text style={styles.stickyTotal}>₹{total.toFixed(0)}</Text>
        </View>
        <Pressable
          testID="place-order-btn"
          onPress={place}
          disabled={placing || !selectedAddr || !selectedSlot || cart.length === 0}
          style={[
            styles.placeBtn,
            (placing || !selectedAddr || !selectedSlot || cart.length === 0) && { opacity: 0.5 },
          ]}
        >
          {placing ? (
            <ActivityIndicator color={theme.colors.onBrand} />
          ) : (
            <>
              <Text style={styles.placeTxt}>Place order</Text>
              <Ionicons name="arrow-forward" size={18} color={theme.colors.onBrand} />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border,
  },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.7)" },
  htitle: { fontSize: 18, fontWeight: "700", color: theme.colors.onSurface },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 10 },
  section: { fontSize: 14, fontWeight: "700", color: theme.colors.onSurface, marginTop: 20, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4 },
  link: { color: theme.colors.brand, fontWeight: "700", fontSize: 13 },

  card: {
    backgroundColor: theme.colors.surface2,
    borderRadius: theme.radius.lg, padding: 14, gap: 8,
    borderWidth: 1, borderColor: theme.colors.border,
    ...theme.shadow.sm,
  },

  addrTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  labelPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: theme.colors.brandTint,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill,
  },
  labelTxt: { fontSize: 11, fontWeight: "700", color: theme.colors.brandDark },
  addrName: { fontSize: 14, fontWeight: "700", color: theme.colors.onSurface, marginTop: 8 },
  addrLine: { fontSize: 13, color: theme.colors.onSurface, lineHeight: 18, marginTop: 4 },

  slotCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, backgroundColor: theme.colors.surface2,
    borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border,
    ...theme.shadow.sm,
  },
  slotActive: { borderColor: theme.colors.brand, backgroundColor: theme.colors.brandTint },
  slotIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: theme.colors.brandTint,
    alignItems: "center", justifyContent: "center",
  },
  slotLabel: { fontSize: 14, fontWeight: "700", color: theme.colors.onSurface },
  slotSub: { fontSize: 12, color: theme.colors.onSurfaceMuted, marginTop: 2 },
  slotFee: { fontSize: 14, fontWeight: "700", color: theme.colors.onSurface },
  fastPill: {
    backgroundColor: "#FF8A2C", paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: theme.radius.pill,
  },
  fastTxt: { fontSize: 8.5, fontWeight: "800", color: "#fff", letterSpacing: 0.4 },

  payIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.colors.brandTint,
    alignItems: "center", justifyContent: "center",
  },
  payName: { fontSize: 14, fontWeight: "700", color: theme.colors.onSurface },
  paySub: { fontSize: 12, color: theme.colors.onSurfaceMuted, marginTop: 2 },
  disabledInfo: { fontSize: 12, color: theme.colors.onSurfaceMuted },

  sumRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 3 },
  sumName: { color: theme.colors.onSurface, fontSize: 13, flex: 1 },
  sumVal: { color: theme.colors.onSurface, fontWeight: "600", fontSize: 13 },
  subMuted: { color: theme.colors.onSurfaceMuted, fontSize: 12 },
  totalName: { color: theme.colors.onSurface, fontSize: 16, fontWeight: "800" },
  totalVal: { color: theme.colors.brand, fontSize: 22, fontWeight: "800" },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 6 },

  stickyCta: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface2,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    ...theme.shadow.lg,
  },
  stickyLabel: { fontSize: 11, color: theme.colors.onSurfaceMuted, fontWeight: "600" },
  stickyTotal: { fontSize: 20, fontWeight: "800", color: theme.colors.brand },
  placeBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.colors.brand,
    paddingHorizontal: 24, height: 52, borderRadius: theme.radius.pill,
  },
  placeTxt: { color: theme.colors.onBrand, fontWeight: "800", fontSize: 15 },

  successWrap: { flex: 1, alignItems: "center", padding: theme.spacing.xl },
  checkCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center", marginTop: 60, ...theme.shadow.lg },
  successH1: { fontSize: 26, fontWeight: "700", color: theme.colors.onSurface, marginTop: 24 },
  successSub: { fontSize: 14, color: theme.colors.onSurfaceMuted, marginTop: 8, textAlign: "center" },
  successId: { fontSize: 13, color: theme.colors.brand, fontWeight: "700", marginTop: 20 },
  successBtn: { marginTop: 40, backgroundColor: theme.colors.brand, paddingHorizontal: 32, paddingVertical: 14, borderRadius: theme.radius.pill },
  successBtnTxt: { color: theme.colors.onBrand, fontWeight: "700" },
  linkBtn: { marginTop: 12, padding: 12 },
});
