import { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { theme } from "@/src/theme";
import { apiFetch } from "@/src/api";
import { useApp } from "@/src/store";

export default function Checkout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ pincode?: string; delivery_fee?: string }>();
  const { cart, cartTotal, clearCart, user } = useApp();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState<"cod" | "stripe">("cod");
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<null | { id: string }>(null);

  const pincode = params.pincode || "";
  const deliveryFee = Number(params.delivery_fee || 0);
  const total = cartTotal + deliveryFee;

  const place = async () => {
    if (!name || !phone || !address) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setBusy(true);
    try {
      const order = await apiFetch("/orders", {
        method: "POST",
        body: JSON.stringify({
          items: cart,
          address: `${name}, ${address}`,
          pincode,
          phone,
          payment_method: payment,
          delivery_fee: deliveryFee,
          subtotal: cartTotal,
          total,
        }),
      });

      if (payment === "stripe") {
        const origin = process.env.EXPO_PUBLIC_BACKEND_URL;
        const res = await apiFetch("/payments/checkout", {
          method: "POST",
          body: JSON.stringify({ order_id: order.id, origin_url: origin }),
        });
        if (res.url) {
          await Linking.openURL(res.url);
          setPlaced({ id: order.id });
          clearCart();
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPlaced({ id: order.id });
        clearCart();
      }
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.log("checkout err", e);
    } finally { setBusy(false); }
  };

  if (placed) {
    return (
      <View style={[styles.successWrap, { paddingTop: insets.top + 40 }]}>
        <Animated.View entering={FadeInDown} style={styles.checkCircle}>
          <Ionicons name="checkmark" size={54} color="#fff" />
        </Animated.View>
        <Animated.Text entering={FadeIn.delay(200)} style={styles.successH1}>Order placed! 🎉</Animated.Text>
        <Animated.Text entering={FadeIn.delay(300)} style={styles.successSub}>
          {payment === "cod"
            ? "We'll deliver fresh to your door soon."
            : "Complete your payment in the browser to confirm."}
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
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={22} color={theme.colors.onSurface} /></Pressable>
        <Text style={styles.htitle}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 220 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>Delivery to</Text>
        <View style={styles.card}>
          <View style={styles.pinBadge}><Ionicons name="location" size={14} color={theme.colors.brand} /><Text style={styles.pinTxt}>{pincode}</Text></View>
          <View style={styles.field}>
            <Ionicons name="person-outline" size={18} color={theme.colors.onSurfaceMuted} />
            <TextInput testID="ck-name" placeholder="Full name" placeholderTextColor={theme.colors.onSurfaceMuted} value={name} onChangeText={setName} style={styles.input} />
          </View>
          <View style={styles.field}>
            <Ionicons name="call-outline" size={18} color={theme.colors.onSurfaceMuted} />
            <TextInput testID="ck-phone" placeholder="Phone number" placeholderTextColor={theme.colors.onSurfaceMuted} keyboardType="phone-pad" value={phone} onChangeText={setPhone} style={styles.input} />
          </View>
          <View style={[styles.field, { alignItems: "flex-start", height: 90 }]}>
            <Ionicons name="home-outline" size={18} color={theme.colors.onSurfaceMuted} style={{ marginTop: 8 }} />
            <TextInput testID="ck-address" placeholder="Full delivery address" placeholderTextColor={theme.colors.onSurfaceMuted} multiline value={address} onChangeText={setAddress} style={[styles.input, { height: 80, textAlignVertical: "top", paddingTop: 8 }]} />
          </View>
        </View>

        <Text style={styles.section}>Payment method</Text>
        <View style={{ gap: 8 }}>
          <Pressable testID="pay-cod" onPress={() => setPayment("cod")} style={[styles.payCard, payment === "cod" && styles.payActive]}>
            <Ionicons name="cash-outline" size={22} color={payment === "cod" ? theme.colors.brand : theme.colors.onSurface} />
            <View style={{ flex: 1 }}>
              <Text style={styles.payName}>Cash on Delivery</Text>
              <Text style={styles.paySub}>Pay when you receive</Text>
            </View>
            {payment === "cod" && <Ionicons name="checkmark-circle" size={22} color={theme.colors.brand} />}
          </Pressable>
          <Pressable testID="pay-stripe" onPress={() => setPayment("stripe")} style={[styles.payCard, payment === "stripe" && styles.payActive]}>
            <Ionicons name="card-outline" size={22} color={payment === "stripe" ? theme.colors.brand : theme.colors.onSurface} />
            <View style={{ flex: 1 }}>
              <Text style={styles.payName}>Card / UPI (Stripe)</Text>
              <Text style={styles.paySub}>Secure test payment</Text>
            </View>
            {payment === "stripe" && <Ionicons name="checkmark-circle" size={22} color={theme.colors.brand} />}
          </Pressable>
        </View>

        <Text style={styles.section}>Order summary</Text>
        <View style={styles.card}>
          {cart.map((i) => (
            <View key={`${i.product_id}-${i.cut_type}-${i.unit}`} style={styles.sumRow}>
              <Text style={styles.sumName} numberOfLines={1}>{i.name} ({i.cut_type}) × {i.quantity}</Text>
              <Text style={styles.sumVal}>₹{(i.price * i.quantity).toFixed(0)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.sumRow}><Text style={styles.sumName}>Subtotal</Text><Text style={styles.sumVal}>₹{cartTotal.toFixed(0)}</Text></View>
          <View style={styles.sumRow}><Text style={styles.sumName}>Delivery</Text><Text style={styles.sumVal}>{deliveryFee ? `₹${deliveryFee}` : "Free"}</Text></View>
          <View style={styles.sumRow}><Text style={styles.totalName}>Total</Text><Text style={styles.totalVal}>₹{total.toFixed(0)}</Text></View>
        </View>
      </ScrollView>

      <View style={[styles.stickyCta, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable testID="place-order-btn" onPress={place} disabled={busy} style={[styles.placeBtn, busy && { opacity: 0.6 }]}>
          <Text style={styles.placeTxt}>{busy ? "Placing..." : payment === "stripe" ? `Pay ₹${total.toFixed(0)}` : `Place order · ₹${total.toFixed(0)}`}</Text>
          <Ionicons name="arrow-forward" size={18} color={theme.colors.onBrand} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.spacing.lg, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surface2 },
  htitle: { fontSize: 18, fontWeight: "700", color: theme.colors.onSurface },
  section: { fontSize: 14, fontWeight: "700", color: theme.colors.onSurface, marginTop: 20, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4 },
  card: { backgroundColor: theme.colors.surface2, borderRadius: theme.radius.lg, padding: theme.spacing.md, gap: 10, ...theme.shadow.sm },
  pinBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: theme.colors.brandTint, paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill },
  pinTxt: { fontSize: 12, fontWeight: "600", color: theme.colors.brand },
  field: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, paddingHorizontal: 12, height: 48 },
  input: { flex: 1, color: theme.colors.onSurface, fontSize: 14 },
  payCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, backgroundColor: theme.colors.surface2, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border },
  payActive: { borderColor: theme.colors.brand, backgroundColor: theme.colors.brandTint },
  payName: { fontSize: 14, fontWeight: "600", color: theme.colors.onSurface },
  paySub: { fontSize: 12, color: theme.colors.onSurfaceMuted, marginTop: 2 },
  sumRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  sumName: { color: theme.colors.onSurfaceMuted, fontSize: 13, flex: 1 },
  sumVal: { color: theme.colors.onSurface, fontWeight: "600", fontSize: 13 },
  totalName: { color: theme.colors.onSurface, fontSize: 16, fontWeight: "700" },
  totalVal: { color: theme.colors.brand, fontSize: 20, fontWeight: "700" },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 6 },
  stickyCta: { position: "absolute", left: 0, right: 0, bottom: 0, padding: theme.spacing.lg, backgroundColor: theme.colors.surface2, borderTopLeftRadius: 24, borderTopRightRadius: 24, ...theme.shadow.md },
  placeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: theme.colors.brand, height: 54, borderRadius: theme.radius.pill },
  placeTxt: { color: theme.colors.onBrand, fontWeight: "700", fontSize: 15 },

  successWrap: { flex: 1, alignItems: "center", padding: theme.spacing.xl, backgroundColor: theme.colors.surface },
  checkCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center", marginTop: 60, ...theme.shadow.lg },
  successH1: { fontSize: 26, fontWeight: "700", color: theme.colors.onSurface, marginTop: 24 },
  successSub: { fontSize: 14, color: theme.colors.onSurfaceMuted, marginTop: 8, textAlign: "center" },
  successId: { fontSize: 13, color: theme.colors.brand, fontWeight: "700", marginTop: 20 },
  successBtn: { marginTop: 40, backgroundColor: theme.colors.brand, paddingHorizontal: 32, paddingVertical: 14, borderRadius: theme.radius.pill },
  successBtnTxt: { color: theme.colors.onBrand, fontWeight: "700" },
  linkBtn: { marginTop: 12, padding: 12 },
});
