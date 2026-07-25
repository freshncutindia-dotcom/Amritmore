import { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, FlatList, ActivityIndicator, TextInput } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { theme, CATEGORIES, CUT_TYPES } from "@/src/theme";
import { apiFetch } from "@/src/api";
import { useApp } from "@/src/store";
import { FloatingCartFab } from "./index";

type Product = {
  id: string; name: string; price: number; unit: string; image: string;
  category: string; cut_type: string; description: string; stock: number; tags: string[];
};

export default function Shop() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const { addToCart, cartCount } = useApp();

  const [category, setCategory] = useState<string>(params.category || "all");
  const [cutType, setCutType] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (category !== "all") qs.set("category", category);
      if (cutType !== "all") qs.set("cut_type", cutType);
      if (search.trim()) qs.set("q", search.trim());
      const data = await apiFetch(`/products${qs.toString() ? `?${qs}` : ""}`);
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [category, cutType, search]);

  useEffect(() => { load(); }, [load]);

  const catTabs = useMemo(() => [{ id: "all", label: "All" }, ...CATEGORIES.map((c) => ({ id: c.id, label: c.label }))], []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Shop</Text>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={theme.colors.onSurfaceMuted} />
          <TextInput
            testID="search-input"
            placeholder="Search vegetables, fruits..."
            placeholderTextColor={theme.colors.onSurfaceMuted}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")}><Ionicons name="close-circle" size={18} color={theme.colors.onSurfaceMuted} /></Pressable>
          ) : null}
        </View>

        {/* Category chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={{ marginTop: 10 }}>
          {catTabs.map((c) => {
            const active = category === c.id;
            return (
              <Pressable
                key={c.id}
                testID={`cat-chip-${c.id}`}
                onPress={() => { Haptics.selectionAsync(); setCategory(c.id); }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Cut type chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {CUT_TYPES.map((c) => {
            const active = cutType === c.id;
            return (
              <Pressable
                key={c.id}
                testID={`cut-chip-${c.id}`}
                onPress={() => { Haptics.selectionAsync(); setCutType(c.id); }}
                style={[styles.chipSm, active && styles.chipSmActive]}
              >
                <Text style={[styles.chipSmText, active && styles.chipSmTextActive]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.brand} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          numColumns={2}
          contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 160, gap: theme.spacing.md }}
          columnWrapperStyle={{ gap: theme.spacing.md }}
          ListEmptyComponent={
            <View style={styles.empty} testID="empty-state">
              <Text style={styles.emptyEmoji}>🥬</Text>
              <Text style={styles.emptyTxt}>No fresh items match your filters</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <GridCard
              product={item}
              index={index}
              onOpen={() => router.push(`/product/${item.id}`)}
              onAdd={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                addToCart({
                  product_id: item.id, name: item.name, price: item.price, quantity: 1,
                  cut_type: item.cut_type, unit: item.unit, image: item.image,
                });
              }}
            />
          )}
        />
      )}

      {cartCount > 0 && <FloatingCartFab onPress={() => router.push("/(tabs)/cart")} />}
    </View>
  );
}

function GridCard({ product, index, onOpen, onAdd }: { product: Product; index: number; onOpen: () => void; onAdd: () => void }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View entering={FadeIn.delay(index * 30)} style={[{ flex: 1 }, style]}>
      <Pressable
        testID={`grid-card-${product.id}`}
        onPress={onOpen}
        onPressIn={() => (scale.value = withSpring(0.97))}
        onPressOut={() => (scale.value = withSpring(1))}
        style={styles.gCard}
      >
        <Image source={{ uri: product.image }} style={styles.gImg} contentFit="cover" />
        <View style={styles.cutBadge}><Text style={styles.cutBadgeTxt}>{product.cut_type}</Text></View>
        <View style={{ padding: theme.spacing.md }}>
          <Text numberOfLines={1} style={styles.gName}>{product.name}</Text>
          <Text style={styles.gMeta}>{product.unit}</Text>
          <View style={styles.gRow}>
            <Text style={styles.gPrice}>₹{product.price}</Text>
            <Pressable testID={`grid-add-${product.id}`} onPress={onAdd} style={styles.gAdd}>
              <Ionicons name="add" size={18} color={theme.colors.onBrand} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  title: { fontSize: 28, fontWeight: "700", color: theme.colors.onSurface, marginBottom: 12 },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.surface3, borderRadius: theme.radius.pill, paddingHorizontal: 14, height: 44, gap: 8 },
  searchInput: { flex: 1, color: theme.colors.onSurface, fontSize: 14 },
  chipRow: { flexDirection: "row", gap: 8, paddingVertical: 8, paddingRight: 16 },
  chip: { height: 36, paddingHorizontal: 16, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.border, justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  chipText: { color: theme.colors.onSurface, fontWeight: "500", fontSize: 13 },
  chipTextActive: { color: theme.colors.onBrand },
  chipSm: { height: 30, paddingHorizontal: 12, borderRadius: theme.radius.pill, backgroundColor: "transparent", borderWidth: 1, borderColor: theme.colors.border, justifyContent: "center", flexShrink: 0 },
  chipSmActive: { backgroundColor: theme.colors.brandTint, borderColor: theme.colors.brand },
  chipSmText: { color: theme.colors.onSurfaceMuted, fontSize: 12, textTransform: "capitalize" },
  chipSmTextActive: { color: theme.colors.brand, fontWeight: "600" },

  gCard: { backgroundColor: theme.colors.surface2, borderRadius: theme.radius.lg, overflow: "hidden", ...theme.shadow.sm },
  gImg: { width: "100%", height: 140 },
  cutBadge: { position: "absolute", top: 10, left: 10, backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill },
  cutBadgeTxt: { fontSize: 10, fontWeight: "600", color: theme.colors.onSurface, textTransform: "capitalize" },
  gName: { color: theme.colors.onSurface, fontWeight: "700", fontSize: 14 },
  gMeta: { color: theme.colors.onSurfaceMuted, fontSize: 12, marginTop: 2 },
  gRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  gPrice: { color: theme.colors.onSurface, fontWeight: "700", fontSize: 15 },
  gAdd: { width: 30, height: 30, borderRadius: 15, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center" },

  empty: { alignItems: "center", padding: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTxt: { color: theme.colors.onSurfaceMuted, fontSize: 14 },
});
