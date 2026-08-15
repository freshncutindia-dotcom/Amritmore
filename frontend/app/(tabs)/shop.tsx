import { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, FlatList, ActivityIndicator, TextInput, Modal, Switch } from "react-native";
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
import { useDrawer } from "@/src/components/SideDrawer";
import { withFocusGate } from "@/src/components/withFocusGate";

type Product = {
  id: string; name: string; local_name?: string; sku?: string; price: number; unit: string; image: string;
  category: string; cut_type: string; description: string; stock: number; tags: string[];
  available_cuts?: string[]; available_weights?: string[];
};

const PRICE_RANGES: { id: string; label: string; min?: number; max?: number }[] = [
  { id: "any", label: "Any price" },
  { id: "u50", label: "Under ₹50", max: 50 },
  { id: "50-100", label: "₹50 – 100", min: 50, max: 100 },
  { id: "100-200", label: "₹100 – 200", min: 100, max: 200 },
  { id: "200+", label: "₹200+", min: 200 },
];

function Shop() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const { addToCart, cartCount } = useApp();
  const drawer = useDrawer();

  const [category, setCategory] = useState<string>(params.category || "all");
  const [cutType, setCutType] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [expandedTerms, setExpandedTerms] = useState<string[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [priceRange, setPriceRange] = useState<string>("any");
  const [inStock, setInStock] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (category !== "all") qs.set("category", category);
      if (cutType !== "all") qs.set("cut_type", cutType);
      if (search.trim()) qs.set("q", search.trim());
      const pr = PRICE_RANGES.find((r) => r.id === priceRange);
      if (pr?.min != null) qs.set("min_price", String(pr.min));
      if (pr?.max != null) qs.set("max_price", String(pr.max));
      if (inStock) qs.set("in_stock", "true");
      const data = await apiFetch(`/products${qs.toString() ? `?${qs}` : ""}`);
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [category, cutType, search, priceRange, inStock]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  // Auto-suggestions with synonym support
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setSuggestions([]); setExpandedTerms([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await apiFetch(`/search/suggest?q=${encodeURIComponent(q)}`);
        setSuggestions(r.suggestions || []);
        setExpandedTerms(r.expanded || []);
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const filtersActive = priceRange !== "any" || inStock;

  const catTabs = useMemo(() => [{ id: "all", label: "All" }, ...CATEGORIES.map((c) => ({ id: c.id, label: c.label }))], []);

  return (
    <View style={{ flex: 1, backgroundColor: "transparent" }}>
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.titleRow}>
          <Pressable testID="shop-menu-btn" onPress={drawer.open} style={styles.menuBtn}>
            <Ionicons name="menu" size={22} color={theme.colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>Shop</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10, zIndex: 30 }}>
          <View style={[styles.searchBar, { flex: 1 }]}>
            <Ionicons name="search" size={18} color={theme.colors.onSurfaceMuted} />
            <TextInput
              testID="search-input"
              placeholder="Try 'dhaniya', 'bhindi', 'mango'…"
              placeholderTextColor={theme.colors.onSurfaceMuted}
              value={search}
              onChangeText={(t) => { setSearch(t); setShowSuggest(true); }}
              onFocus={() => setShowSuggest(true)}
              onBlur={() => setTimeout(() => setShowSuggest(false), 250)}
              style={styles.searchInput}
            />
            {search ? (
              <Pressable onPress={() => { setSearch(""); setShowSuggest(false); }}><Ionicons name="close-circle" size={18} color={theme.colors.onSurfaceMuted} /></Pressable>
            ) : null}
          </View>
          <Pressable testID="filter-btn" onPress={() => setFilterOpen(true)} style={styles.filterBtn}>
            <Ionicons name="options-outline" size={20} color={theme.colors.onSurface} />
            {filtersActive && <View style={styles.filterDot} />}
          </Pressable>

          {showSuggest && search.trim().length >= 2 && suggestions.length > 0 && (
            <View style={styles.suggestBox} testID="suggest-box">
              {expandedTerms.length > 0 && (
                <Text style={styles.suggestHint}>Also matching: {expandedTerms.join(", ")}</Text>
              )}
              {suggestions.map((s) => (
                <Pressable
                  key={s.id}
                  testID={`suggest-${s.id}`}
                  style={styles.suggestRow}
                  onPress={() => { setShowSuggest(false); router.push(`/product/${s.id}`); }}
                >
                  <Image source={{ uri: s.image }} style={styles.suggestImg} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestName} numberOfLines={1}>{s.name}</Text>
                    <Text style={styles.suggestMeta} numberOfLines={1}>{s.local_name ? `${s.local_name} · ` : ""}₹{s.price} · {s.unit}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={14} color={theme.colors.onSurfaceMuted} />
                </Pressable>
              ))}
            </View>
          )}
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

      <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: theme.colors.scrim }}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFilterOpen(false)} />
          <View style={styles.filterSheet}>
            <Text style={styles.filterTitle}>Filters</Text>
            <Text style={styles.filterLbl}>Price per pack</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {PRICE_RANGES.map((r) => (
                <Pressable key={r.id} testID={`price-${r.id}`} onPress={() => setPriceRange(r.id)} style={[styles.chip, priceRange === r.id && styles.chipActive]}>
                  <Text style={[styles.chipText, priceRange === r.id && styles.chipTextActive]}>{r.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.stockRow}>
              <Text style={styles.filterLbl}>In stock only</Text>
              <Switch testID="instock-switch" value={inStock} onValueChange={setInStock} trackColor={{ false: theme.colors.border, true: theme.colors.brand }} thumbColor="#fff" />
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Pressable testID="filter-reset" onPress={() => { setPriceRange("any"); setInStock(false); }} style={[styles.filterAction, { backgroundColor: theme.colors.surface3 }]}>
                <Text style={{ fontWeight: "700", color: theme.colors.onSurface }}>Reset</Text>
              </Pressable>
              <Pressable testID="filter-apply" onPress={() => setFilterOpen(false)} style={[styles.filterAction, { backgroundColor: theme.colors.brand }]}>
                <Text style={{ fontWeight: "700", color: theme.colors.onBrand }}>Show results</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {cartCount > 0 && <FloatingCartFab onPress={() => router.push("/(tabs)/cart")} />}
    </View>
  );
}
export default withFocusGate(Shop);

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
          {product.local_name ? <Text numberOfLines={1} style={styles.gLocal}>{product.local_name}</Text> : null}
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
    backgroundColor: "transparent",
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.6)",
  },
  title: { fontSize: 28, fontWeight: "700", color: theme.colors.onSurface },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  menuBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surface2, alignItems: "center", justifyContent: "center", ...theme.shadow.sm },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.surface3, borderRadius: theme.radius.pill, paddingHorizontal: 14, height: 44, gap: 8 },
  searchInput: { flex: 1, color: theme.colors.onSurface, fontSize: 14 },
  filterBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.surface2, alignItems: "center", justifyContent: "center", ...theme.shadow.sm },
  filterDot: { position: "absolute", top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.brand },
  suggestBox: { position: "absolute", top: 50, left: 0, right: 54, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 6, zIndex: 50, elevation: 10, ...theme.shadow.md },
  suggestHint: { fontSize: 11, color: theme.colors.brandDark, fontWeight: "600", paddingHorizontal: 10, paddingTop: 6 },
  suggestRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderRadius: theme.radius.md },
  suggestImg: { width: 36, height: 36, borderRadius: theme.radius.sm },
  suggestName: { fontSize: 13, fontWeight: "700", color: theme.colors.onSurface },
  suggestMeta: { fontSize: 11, color: theme.colors.onSurfaceMuted, marginTop: 1 },
  filterSheet: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: theme.spacing.lg, paddingBottom: 34, gap: 12 },
  filterTitle: { fontSize: 18, fontWeight: "800", color: theme.colors.onSurface },
  filterLbl: { fontSize: 13, fontWeight: "700", color: theme.colors.onSurfaceMuted },
  stockRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  filterAction: { flex: 1, height: 48, borderRadius: theme.radius.pill, alignItems: "center", justifyContent: "center" },
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
  gLocal: { color: theme.colors.onSurfaceMuted, fontSize: 11, marginTop: 1, fontStyle: "italic" },
  gMeta: { color: theme.colors.onSurfaceMuted, fontSize: 12, marginTop: 2 },
  gRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  gPrice: { color: theme.colors.onSurface, fontWeight: "700", fontSize: 15 },
  gAdd: { width: 30, height: 30, borderRadius: 15, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center" },

  empty: { alignItems: "center", padding: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTxt: { color: theme.colors.onSurfaceMuted, fontSize: 14 },
});
