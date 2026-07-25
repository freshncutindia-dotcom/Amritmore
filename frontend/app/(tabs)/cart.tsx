import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, Layout, useAnimatedStyle, useSharedValue, withSpring, withTiming, runOnJS } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";

import { theme } from "@/src/theme";
import { apiFetch } from "@/src/api";
import { useApp, CartItem } from "@/src/store";

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cart, updateQty, removeFromCart, cartTotal, cartCount, user } = useApp();
  const [pincode, setPincode] = useState("");
  const [checking, setChecking] = useState(false);
  const [pinResult, setPinResult] = useState<null | { serviceable: boolean; area?: string; eta_hours?: number; delivery_fee?: number; message?: string }>(null);

  const checkPin = async () => {
    if (!/^\d{6}$/.test(pincode)) {
      setPinResult({ serviceable: false, message: "Enter a valid 6-digit pincode" });
      return;
    }
    setChecking(true);
    try {
      const res = await apiFetch(`/pincodes/check/${pincode}`);
      setPinResult(res);
      Haptics.notificationAsync(res.serviceable ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
    } catch (e: any) {
      setPinResult({ serviceable: false, message: e.message });
    } finally {
      setChecking(false);
    }
  };

  const deliveryFee = pinResult?.serviceable ? pinResult.delivery_fee ?? 0 : 0;
  const finalTotal = cartTotal + deliveryFee;

  const proceed = () => {
    if (!user) {
      router.push({ pathname: "/auth", params: { redirect: "/checkout", pincode, delivery_fee: String(deliveryFee) } });
      return;
    }
    router.push({ pathname: "/checkout", params: { pincode, delivery_fee: String(deliveryFee) } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>My Basket</Text>
        <Text style={styles.subtitle}>{cartCount} item{cartCount !== 1 ? "s" : ""}</Text>
      </View>

      {cart.length === 0 ? (
        <View style={styles.empty} testID="empty-cart">
          <Text style={styles.emptyEmoji}>🧺</Text>
          <Text style={styles.emptyTitle}>Your basket is empty</Text>
          <Text style={styles.emptyTxt}>Add some fresh veggies & fruits to get started</Text>
          <Pressable testID="empty-shop-btn" style={styles.emptyBtn} onPress={() => router.push("/(tabs)/shop")}>
            <Text style={styles.emptyBtnTxt}>Browse fresh produce</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 260 }} showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md, marginTop: 12 }}>
            {cart.map((item, i) => (
              <SwipeRow
                key={`${item.product_id}-${item.cut_type}-${item.unit}`}
                item={item}
                index={i}
                onDelete={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  removeFromCart(item.product_id, item.cut_type, item.unit);
                }}
                onInc={() => updateQty(item.product_id, item.cut_type, item.unit, item.quantity + 1)}
                onDec={() => updateQty(item.product_id, item.cut_type, item.unit, item.quantity - 1)}
              />
            ))}
          </View>

          {/* Pincode check */}
          <View style={styles.pincodeBox}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Ionicons name="location" size={18} color={theme.colors.brand} />
              <Text style={styles.pinTitle}>Check delivery to your area</Text>
            </View>
            <View style={styles.pinRow}>
              <TextInput
                testID="pincode-input"
                placeholder="Enter 6-digit pincode"
                placeholderTextColor={theme.colors.onSurfaceMuted}
                keyboardType="number-pad"
                maxLength={6}
                value={pincode}
                onChangeText={setPincode}
                style={styles.pinInput}
              />
              <Pressable testID="check-pin-btn" onPress={checkPin} style={styles.pinBtn} disabled={checking}>
                <Text style={styles.pinBtnTxt}>{checking ? "..." : "Check"}</Text>
              </Pressable>
            </View>
            {pinResult && (
              <Animated.View entering={FadeInDown} style={[styles.pinResult, { backgroundColor: pinResult.serviceable ? theme.colors.brandTint : "#FDECE7" }]}>
                <Ionicons
                  name={pinResult.serviceable ? "checkmark-circle" : "alert-circle"}
                  size={16}
                  color={pinResult.serviceable ? theme.colors.brand : theme.colors.error}
                />
                <Text style={styles.pinResultTxt}>
                  {pinResult.serviceable
                    ? `Deliver to ${pinResult.area} in ${pinResult.eta_hours}h · ${pinResult.delivery_fee ? `₹${pinResult.delivery_fee} fee` : "Free delivery"}`
                    : pinResult.message}
                </Text>
              </Animated.View>
            )}
          </View>
        </ScrollView>
      )}

      {cart.length > 0 && (
        <View style={[styles.summary, { paddingBottom: insets.bottom + 92 }]} testID="cart-summary">
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLbl}>Subtotal</Text>
            <Text style={styles.summaryVal}>₹{cartTotal.toFixed(0)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLbl}>Delivery</Text>
            <Text style={styles.summaryVal}>{deliveryFee ? `₹${deliveryFee.toFixed(0)}` : "Free"}</Text>
          </View>
          <View style={[styles.summaryRow, { marginTop: 6 }]}>
            <Text style={styles.totalLbl}>Total</Text>
            <Text style={styles.totalVal}>₹{finalTotal.toFixed(0)}</Text>
          </View>
          <Pressable
            testID="proceed-checkout-btn"
            onPress={proceed}
            disabled={!pinResult?.serviceable}
            style={[styles.proceedBtn, !pinResult?.serviceable && styles.proceedDisabled]}
          >
            <Text style={styles.proceedTxt}>{pinResult?.serviceable ? "Proceed to Checkout" : "Check pincode to continue"}</Text>
            {pinResult?.serviceable && <Ionicons name="arrow-forward" size={18} color={theme.colors.onBrand} />}
          </Pressable>
        </View>
      )}
    </View>
  );
}

function SwipeRow({ item, index, onDelete, onInc, onDec }: { item: CartItem; index: number; onDelete: () => void; onInc: () => void; onDec: () => void }) {
  const tx = useSharedValue(0);
  const opacity = useSharedValue(1);
  const height = useSharedValue(96);

  const dismiss = () => {
    onDelete();
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((e) => {
      if (e.translationX < 0) tx.value = e.translationX;
    })
    .onEnd((e) => {
      if (e.translationX < -100) {
        tx.value = withTiming(-500, { duration: 200 });
        opacity.value = withTiming(0, { duration: 200 });
        height.value = withTiming(0, { duration: 200 }, () => runOnJS(dismiss)());
      } else {
        tx.value = withSpring(0);
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View entering={FadeInDown.delay(index * 30)} layout={Layout} style={{ position: "relative" }}>
      <View style={styles.deleteBg}>
        <Ionicons name="trash" size={22} color="#fff" />
        <Text style={styles.deleteTxt}>Swipe to delete</Text>
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.cartCard, rowStyle]} testID={`cart-item-${item.product_id}`}>
          <Image source={{ uri: item.image }} style={styles.cartImg} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text style={styles.cartName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.cartMeta}>{item.cut_type} · {item.unit}</Text>
            <Text style={styles.cartPrice}>₹{(item.price * item.quantity).toFixed(0)}</Text>
          </View>
          <View style={styles.qtyBox}>
            <Pressable testID={`dec-${item.product_id}`} onPress={onDec} style={styles.qtyBtn}>
              <Ionicons name="remove" size={16} color={theme.colors.onSurface} />
            </Pressable>
            <Text style={styles.qtyTxt}>{item.quantity}</Text>
            <Pressable testID={`inc-${item.product_id}`} onPress={onInc} style={styles.qtyBtn}>
              <Ionicons name="add" size={16} color={theme.colors.onSurface} />
            </Pressable>
          </View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: theme.spacing.lg, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: "700", color: theme.colors.onSurface },
  subtitle: { fontSize: 13, color: theme.colors.onSurfaceMuted, marginTop: 2 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: theme.colors.onSurface, marginBottom: 6 },
  emptyTxt: { color: theme.colors.onSurfaceMuted, textAlign: "center", marginBottom: 24 },
  emptyBtn: { backgroundColor: theme.colors.brand, paddingHorizontal: 24, paddingVertical: 12, borderRadius: theme.radius.pill },
  emptyBtnTxt: { color: theme.colors.onBrand, fontWeight: "600" },

  cartCard: { flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.surface2, borderRadius: theme.radius.lg, padding: theme.spacing.sm, gap: 10, ...theme.shadow.sm },
  cartImg: { width: 68, height: 68, borderRadius: theme.radius.md },
  cartName: { color: theme.colors.onSurface, fontWeight: "700", fontSize: 14 },
  cartMeta: { color: theme.colors.onSurfaceMuted, fontSize: 12, textTransform: "capitalize", marginTop: 2 },
  cartPrice: { color: theme.colors.onSurface, fontWeight: "700", marginTop: 4, fontSize: 15 },
  qtyBox: { flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.surface3, borderRadius: theme.radius.pill, paddingHorizontal: 6, paddingVertical: 4, gap: 8 },
  qtyBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.colors.surface2, alignItems: "center", justifyContent: "center" },
  qtyTxt: { minWidth: 16, textAlign: "center", fontWeight: "700", color: theme.colors.onSurface },
  deleteBg: { position: "absolute", top: 0, right: 0, bottom: 0, width: 140, backgroundColor: theme.colors.error, borderRadius: theme.radius.lg, alignItems: "flex-end", justifyContent: "center", flexDirection: "row", gap: 8, paddingRight: 20, alignContent: "center" },
  deleteTxt: { color: "#fff", fontSize: 12, fontWeight: "600", alignSelf: "center" },

  pincodeBox: { marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.xl, padding: theme.spacing.lg, backgroundColor: theme.colors.surface2, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border },
  pinTitle: { fontSize: 14, fontWeight: "600", color: theme.colors.onSurface },
  pinRow: { flexDirection: "row", gap: 10 },
  pinInput: { flex: 1, backgroundColor: theme.colors.surface3, borderRadius: theme.radius.md, paddingHorizontal: 14, height: 44, color: theme.colors.onSurface, fontSize: 14 },
  pinBtn: { paddingHorizontal: 20, height: 44, borderRadius: theme.radius.md, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center" },
  pinBtnTxt: { color: theme.colors.onBrand, fontWeight: "700" },
  pinResult: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: theme.radius.md, marginTop: 12 },
  pinResultTxt: { flex: 1, fontSize: 12, color: theme.colors.onSurface },

  summary: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.surface2, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: theme.spacing.lg, ...theme.shadow.md },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  summaryLbl: { color: theme.colors.onSurfaceMuted, fontSize: 13 },
  summaryVal: { color: theme.colors.onSurface, fontWeight: "600", fontSize: 13 },
  totalLbl: { color: theme.colors.onSurface, fontSize: 16, fontWeight: "700" },
  totalVal: { color: theme.colors.brand, fontSize: 22, fontWeight: "700" },
  proceedBtn: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: theme.colors.brand, height: 52, borderRadius: theme.radius.pill },
  proceedDisabled: { backgroundColor: theme.colors.borderStrong },
  proceedTxt: { color: theme.colors.onBrand, fontWeight: "700", fontSize: 15 },
});
