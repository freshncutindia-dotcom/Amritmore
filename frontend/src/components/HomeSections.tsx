import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, Platform } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { theme } from "@/src/theme";
import { apiFetch } from "@/src/api";
import { useApp } from "@/src/store";

export type Deal = {
  id: string;
  product_id: string;
  discount_pct: number;
  banner_text?: string | null;
  product_name: string;
  product_image: string;
  product_unit: string;
  original_price: number;
  deal_price: number;
  category: string;
  cut_type: string;
};

export function DailyDealsCarousel() {
  const router = useRouter();
  const { addToCart } = useApp();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data: Deal[] = await apiFetch("/deals");
      setDeals(data);
    } catch {
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.7 + pulse.value * 0.3,
  }));

  if (loading || deals.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Animated.View style={pulseStyle}>
            <Text style={styles.flame}>🔥</Text>
          </Animated.View>
          <Text style={styles.title}>Daily Deals</Text>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveTxt}>LIVE</Text>
          </View>
        </View>
      </View>

      <FlatList
        horizontal
        data={deals}
        keyExtractor={(d) => d.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, gap: 12 }}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeIn.delay(index * 60)}>
            <Pressable
              testID={`deal-card-${item.id}`}
              onPress={() => router.push(`/product/${item.product_id}`)}
              style={styles.card}
            >
              <View style={styles.badgeWrap}>
                <View style={styles.badge}>
                  <Text style={styles.badgeTxt}>-{item.discount_pct}%</Text>
                </View>
              </View>
              <Image source={{ uri: item.product_image }} style={styles.img} contentFit="cover" />
              <View style={styles.body}>
                <Text numberOfLines={1} style={styles.name}>{item.product_name}</Text>
                <Text numberOfLines={1} style={styles.meta}>{item.product_unit}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.dealPrice}>₹{Math.round(item.deal_price)}</Text>
                  <Text style={styles.origPrice}>₹{Math.round(item.original_price)}</Text>
                </View>
                <Pressable
                  testID={`deal-add-${item.id}`}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    addToCart({
                      product_id: item.product_id,
                      name: item.product_name,
                      price: item.deal_price,
                      quantity: 1,
                      cut_type: item.cut_type || "whole",
                      unit: item.product_unit,
                      image: item.product_image,
                    });
                  }}
                  style={styles.grabBtn}
                >
                  <Ionicons name="flash" size={13} color={theme.colors.onBrand} />
                  <Text style={styles.grabTxt}>Grab</Text>
                </Pressable>
              </View>
            </Pressable>
          </Animated.View>
        )}
      />
    </View>
  );
}


// ---- Quick Buy Again ----
export type QuickItem = {
  product_id: string;
  name: string;
  image: string;
  price: number;
  unit: string;
  cut_type: string;
  order_count: number;
};

export function QuickBuyAgain() {
  const router = useRouter();
  const { user, addToCart } = useApp();
  const [items, setItems] = useState<QuickItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const data: QuickItem[] = await apiFetch("/orders/quick-buy-again");
        setItems(data || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (loading || !user || items.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Ionicons name="repeat-outline" size={18} color={theme.colors.brand} />
          <Text style={styles.title}>Quick Buy Again</Text>
        </View>
        <Pressable onPress={() => router.push("/orders")}>
          <Text style={styles.seeAll}>See all</Text>
        </Pressable>
      </View>

      <FlatList
        horizontal
        data={items}
        keyExtractor={(i) => `${i.product_id}-${i.cut_type}-${i.unit}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, gap: 10 }}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeIn.delay(index * 50)}>
            <Pressable
              testID={`quick-item-${item.product_id}`}
              onPress={() => router.push(`/product/${item.product_id}`)}
              style={styles.quickCard}
            >
              <Image source={{ uri: item.image }} style={styles.quickImg} contentFit="cover" />
              <View style={{ flex: 1, padding: 10 }}>
                <Text numberOfLines={1} style={styles.quickName}>{item.name}</Text>
                <Text numberOfLines={1} style={styles.quickMeta}>{item.unit}</Text>
                <View style={styles.quickBottom}>
                  <Text style={styles.quickPrice}>₹{Math.round(item.price)}</Text>
                  <Pressable
                    testID={`quick-add-${item.product_id}`}
                    onPress={() => {
                      Haptics.selectionAsync();
                      addToCart({
                        product_id: item.product_id,
                        name: item.name,
                        price: item.price,
                        quantity: 1,
                        cut_type: item.cut_type,
                        unit: item.unit,
                        image: item.image,
                      });
                    }}
                    style={styles.quickAdd}
                  >
                    <Ionicons name="add" size={16} color={theme.colors.onBrand} />
                  </Pressable>
                </View>
              </View>
            </Pressable>
          </Animated.View>
        )}
      />
    </View>
  );
}


const CARD_W = 158;

const styles = StyleSheet.create({
  section: { marginTop: 18 },
  headerRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg, marginBottom: 12,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  flame: { fontSize: 18 },
  title: { fontSize: 18, fontWeight: "700", color: theme.colors.onSurface },
  seeAll: { color: theme.colors.brand, fontSize: 13, fontWeight: "700" },
  livePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#FF3355", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: theme.radius.pill,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#fff" },
  liveTxt: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },

  // Deal card
  card: {
    width: CARD_W, backgroundColor: theme.colors.surface2,
    borderRadius: theme.radius.lg, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(79,163,227,0.15)",
    ...theme.shadow.sm,
  },
  badgeWrap: { position: "absolute", top: 8, left: 8, zIndex: 2 },
  badge: {
    backgroundColor: "#FF3355",
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: theme.radius.sm,
  },
  badgeTxt: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  img: { width: CARD_W, height: 100 },
  body: { padding: 10, gap: 3 },
  name: { fontSize: 13, fontWeight: "700", color: theme.colors.onSurface },
  meta: { fontSize: 11, color: theme.colors.onSurfaceMuted },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 4 },
  dealPrice: { fontSize: 16, fontWeight: "800", color: theme.colors.brand },
  origPrice: { fontSize: 11, color: theme.colors.onSurfaceMuted, textDecorationLine: "line-through" },
  grabBtn: {
    marginTop: 6, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
    backgroundColor: theme.colors.brand, paddingVertical: 7,
    borderRadius: theme.radius.pill,
  },
  grabTxt: { color: theme.colors.onBrand, fontSize: 12, fontWeight: "700" },

  // Quick buy again
  quickCard: {
    width: 200, flexDirection: "row", alignItems: "stretch",
    backgroundColor: theme.colors.surface2,
    borderRadius: theme.radius.lg, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(79,163,227,0.15)",
    ...theme.shadow.sm,
  },
  quickImg: { width: 74, height: "100%" },
  quickName: { fontSize: 13, fontWeight: "700", color: theme.colors.onSurface },
  quickMeta: { fontSize: 11, color: theme.colors.onSurfaceMuted, marginTop: 2 },
  quickBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  quickPrice: { fontSize: 14, fontWeight: "800", color: theme.colors.onSurface },
  quickAdd: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: theme.colors.brand,
    alignItems: "center", justifyContent: "center",
  },
});
