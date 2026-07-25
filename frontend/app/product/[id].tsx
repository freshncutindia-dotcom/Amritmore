import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { theme, CUT_TYPES } from "@/src/theme";
import { apiFetch } from "@/src/api";
import { useApp } from "@/src/store";

const UNITS = ["250g", "500g", "1kg"];

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addToCart } = useApp();

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cutType, setCutType] = useState<string>("");
  const [unit, setUnit] = useState<string>("500g");
  const [qty, setQty] = useState(1);

  const btnScale = useSharedValue(1);
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch(`/products/${id}`);
        setProduct(data);
        setCutType(data.cut_type);
        setUnit(data.unit || "500g");
      } finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={theme.colors.brand} />
    </View>
  );
  if (!product) return null;

  const unitMultiplier = unit === "250g" ? 0.5 : unit === "1kg" ? 2 : 1;
  const displayPrice = Math.round(product.price * unitMultiplier);
  const total = displayPrice * qty;

  const handleAdd = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    btnScale.value = withSpring(0.92, { damping: 4 }, () => { btnScale.value = withSpring(1); });
    addToCart({
      product_id: product.id,
      name: product.name,
      price: displayPrice,
      quantity: qty,
      cut_type: cutType || product.cut_type,
      unit,
      image: product.image,
    });
    setTimeout(() => router.back(), 500);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 200 }} showsVerticalScrollIndicator={false}>
        <View style={styles.imgWrap}>
          <Image source={{ uri: product.image }} style={styles.img} contentFit="cover" />
          <LinearGradient colors={["rgba(0,0,0,0.35)", "transparent"]} style={styles.imgScrim} />
          <Pressable testID="back-btn" onPress={() => router.back()} style={[styles.backBtn, { top: insets.top + 12 }]}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.onSurface} />
          </Pressable>
          <View style={[styles.cutBadge, { top: insets.top + 12 }]}>
            <Text style={styles.cutBadgeTxt}>{product.cut_type}</Text>
          </View>
        </View>

        <Animated.View entering={FadeInUp} style={styles.body}>
          <Text style={styles.name}>{product.name}</Text>
          <View style={styles.rowMeta}>
            {product.tags.map((t: string) => (
              <View key={t} style={styles.tag}><Text style={styles.tagTxt}>#{t}</Text></View>
            ))}
          </View>
          <Text style={styles.desc}>{product.description}</Text>

          {(product.category === "cut-veg" || product.category === "cut-fruit") && (
            <>
              <Text style={styles.label}>Cut style</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {CUT_TYPES.filter((c) => c.id !== "all").map((c) => {
                  const active = (cutType || product.cut_type) === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      testID={`cut-opt-${c.id}`}
                      onPress={() => { Haptics.selectionAsync(); setCutType(c.id); }}
                      style={[styles.optChip, active && styles.optChipActive]}
                    >
                      <Text style={[styles.optChipTxt, active && styles.optChipTxtActive]}>{c.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}

          <Text style={styles.label}>Pack size</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {UNITS.map((u) => {
              const active = unit === u;
              return (
                <Pressable
                  key={u}
                  testID={`unit-${u}`}
                  onPress={() => { Haptics.selectionAsync(); setUnit(u); }}
                  style={[styles.unitChip, active && styles.unitChipActive]}
                >
                  <Text style={[styles.unitTxt, active && styles.unitTxtActive]}>{u}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Quantity</Text>
          <View style={styles.qtyBox}>
            <Pressable testID="qty-dec" onPress={() => setQty((q) => Math.max(1, q - 1))} style={styles.qBtn}>
              <Ionicons name="remove" size={20} color={theme.colors.onSurface} />
            </Pressable>
            <Text style={styles.qtyN}>{qty}</Text>
            <Pressable testID="qty-inc" onPress={() => setQty((q) => q + 1)} style={styles.qBtn}>
              <Ionicons name="add" size={20} color={theme.colors.onSurface} />
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>

      <View style={[styles.stickyCta, { paddingBottom: insets.bottom + 12 }]}>
        <View>
          <Text style={styles.stickyLbl}>Total</Text>
          <Text style={styles.stickyPrice}>₹{total}</Text>
        </View>
        <Animated.View style={[btnStyle, { flex: 1 }]}>
          <Pressable testID="add-to-cart-btn" onPress={handleAdd} style={styles.addBtn}>
            <Ionicons name="basket" size={18} color={theme.colors.onBrand} />
            <Text style={styles.addTxt}>Add to basket</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  imgWrap: { width: "100%", aspectRatio: 1, position: "relative" },
  img: { width: "100%", height: "100%" },
  imgScrim: { position: "absolute", top: 0, left: 0, right: 0, height: 120 },
  backBtn: { position: "absolute", left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center" },
  cutBadge: { position: "absolute", right: 16, backgroundColor: theme.colors.brand, paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.pill },
  cutBadgeTxt: { color: theme.colors.onBrand, fontWeight: "700", fontSize: 12, textTransform: "capitalize" },

  body: { padding: theme.spacing.lg, gap: 6 },
  name: { fontSize: 28, fontWeight: "700", color: theme.colors.onSurface },
  rowMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8, marginBottom: 4 },
  tag: { backgroundColor: theme.colors.brandTint, paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.sm },
  tagTxt: { color: theme.colors.brand, fontSize: 11, fontWeight: "600" },
  desc: { color: theme.colors.onSurfaceMuted, fontSize: 14, lineHeight: 22, marginTop: 6 },
  label: { fontSize: 14, fontWeight: "700", color: theme.colors.onSurface, marginTop: 22, marginBottom: 10 },
  optChip: { paddingHorizontal: 14, height: 36, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface2, justifyContent: "center" },
  optChipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  optChipTxt: { fontSize: 12, color: theme.colors.onSurface, textTransform: "capitalize" },
  optChipTxtActive: { color: theme.colors.onBrand, fontWeight: "600" },
  unitChip: { flex: 1, height: 44, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface2, alignItems: "center", justifyContent: "center" },
  unitChipActive: { backgroundColor: theme.colors.brandTint, borderColor: theme.colors.brand },
  unitTxt: { color: theme.colors.onSurface, fontWeight: "500" },
  unitTxtActive: { color: theme.colors.brand, fontWeight: "700" },
  qtyBox: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", backgroundColor: theme.colors.surface3, borderRadius: theme.radius.pill, padding: 4, gap: 12 },
  qBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.colors.surface2, alignItems: "center", justifyContent: "center" },
  qtyN: { fontSize: 16, fontWeight: "700", minWidth: 20, textAlign: "center", color: theme.colors.onSurface },

  stickyCta: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.surface2, padding: theme.spacing.lg, flexDirection: "row", alignItems: "center", gap: 14, borderTopLeftRadius: 24, borderTopRightRadius: 24, ...theme.shadow.md },
  stickyLbl: { fontSize: 11, color: theme.colors.onSurfaceMuted },
  stickyPrice: { fontSize: 22, fontWeight: "700", color: theme.colors.onSurface },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.brand, height: 52, borderRadius: theme.radius.pill, gap: 8 },
  addTxt: { color: theme.colors.onBrand, fontWeight: "700", fontSize: 15 },
});
