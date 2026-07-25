import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator, FlatList } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeIn, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { theme, CATEGORIES } from "@/src/theme";
import { apiFetch } from "@/src/api";
import { useApp } from "@/src/store";
import { useDrawer } from "@/src/components/SideDrawer";

type Product = {
  id: string; name: string; price: number; unit: string; image: string;
  category: string; cut_type: string; description: string; stock: number; tags: string[];
};

const HERO_URL = "https://images.pexels.com/photos/3987343/pexels-photo-3987343.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, cartCount, addToCart } = useApp();
  const drawer = useDrawer();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch("/products");
      setProducts(data);
    } catch (e) {
      console.log("load err", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    load();
  };

  const featured = products.slice(0, 6);
  const bestSellers = products.filter((p) => p.category === "cut-veg" || p.category === "cut-fruit").slice(0, 5);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand} />}
      >
        {/* Brand header with logo */}
        <View style={[styles.brandHeader, { paddingTop: insets.top + 12 }]}>
          <View style={styles.brandTop}>
            <Pressable testID="home-menu-btn" onPress={drawer.open} style={styles.brandMenuBtn}>
              <Ionicons name="menu" size={22} color={theme.colors.onSurface} />
            </Pressable>
            <View style={styles.locPill}>
              <Ionicons name="location" size={12} color={theme.colors.brand} />
              <Text style={styles.locTxt}>Deliver to Bengaluru</Text>
            </View>
            <Pressable testID="profile-quick-btn" onPress={() => router.push("/(tabs)/profile")} style={styles.brandMenuBtn}>
              <Ionicons name="person-outline" size={20} color={theme.colors.onSurface} />
            </Pressable>
          </View>
          <Image source={require("../../assets/images/logo.webp")} style={styles.brandLogo} contentFit="contain" />
          <Text style={styles.brandGreet}>{user?.name ? `Hi ${user.name.split(" ")[0]}, ` : ""}Farm-fresh, minutes away.</Text>
        </View>

        {/* Hero CTA banner */}
        <View style={styles.hero}>
          <Image source={{ uri: HERO_URL }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          <LinearGradient
            colors={["rgba(43,58,44,0.15)", "rgba(43,58,44,0.75)"]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Farm‑fresh{"\n"}delivered in hours.</Text>
            <Pressable
              testID="hero-cta-btn"
              onPress={() => router.push("/(tabs)/shop")}
              style={styles.heroCta}
            >
              <Text style={styles.heroCtaText}>Shop Fresh</Text>
              <Ionicons name="arrow-forward" size={16} color={theme.colors.onSurface} />
            </Pressable>
          </View>
        </View>

        {/* Categories */}
        <Animated.View entering={FadeInDown.delay(50)} style={styles.section}>
          <Text style={styles.sectionTitle}>Shop by category</Text>
          <View style={styles.catGrid}>
            {CATEGORIES.map((c, i) => (
              <Pressable
                key={c.id}
                testID={`category-${c.id}`}
                style={styles.catCard}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push({ pathname: "/(tabs)/shop", params: { category: c.id } });
                }}
              >
                <Image source={{ uri: c.image }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                <LinearGradient colors={["transparent", "rgba(0,0,0,0.55)"]} style={StyleSheet.absoluteFillObject} />
                <Text style={styles.catEmoji}>{c.emoji}</Text>
                <Text style={styles.catLabel}>{c.label}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Subscribe & Save promo */}
        <Animated.View entering={FadeInDown.delay(80)} style={{ marginTop: theme.spacing.xl, paddingHorizontal: theme.spacing.lg }}>
          <Pressable testID="home-subscribe-cta" onPress={() => router.push("/subscribe")} style={styles.subPromo}>
            <LinearGradient colors={[theme.colors.brand, theme.colors.brandDark]} style={StyleSheet.absoluteFillObject} />
            <View style={{ flex: 1, padding: 18 }}>
              <View style={styles.subBadge}><Text style={styles.subBadgeTxt}>NEW · Subscribe & Save</Text></View>
              <Text style={styles.subH1}>Weekly veggie box{"\n"}from ₹599</Text>
              <View style={styles.subArrowRow}>
                <Text style={styles.subCta}>Set up your box</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </View>
            </View>
            <Text style={styles.subEmoji}>🥬</Text>
          </Pressable>
        </Animated.View>

        {/* Featured */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Fresh picks</Text>
            <Pressable onPress={() => router.push("/(tabs)/shop")}>
              <Text style={styles.link}>See all</Text>
            </Pressable>
          </View>
          {loading ? (
            <ActivityIndicator color={theme.colors.brand} style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              horizontal
              data={featured}
              keyExtractor={(i) => i.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md }}
              renderItem={({ item }) => (
                <ProductCardBig product={item} onOpen={() => router.push(`/product/${item.id}`)} onAdd={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  addToCart({
                    product_id: item.id, name: item.name, price: item.price, quantity: 1,
                    cut_type: item.cut_type, unit: item.unit, image: item.image,
                  });
                }} />
              )}
            />
          )}
        </Animated.View>

        {/* Ready-to-cook */}
        <Animated.View entering={FadeInDown.delay(150)} style={styles.section}>
          <Text style={styles.sectionTitle}>Ready-to-cook · Ready-to-eat</Text>
          <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md }}>
            {bestSellers.map((p) => (
              <Pressable
                key={p.id}
                testID={`bestseller-${p.id}`}
                style={styles.rowCard}
                onPress={() => router.push(`/product/${p.id}`)}
              >
                <Image source={{ uri: p.image }} style={styles.rowImg} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{p.name}</Text>
                  <Text style={styles.rowMeta}>{p.cut_type} · {p.unit}</Text>
                  <Text style={styles.rowPrice}>₹{p.price}</Text>
                </View>
                <Pressable
                  testID={`row-add-${p.id}`}
                  onPress={() => {
                    Haptics.selectionAsync();
                    addToCart({
                      product_id: p.id, name: p.name, price: p.price, quantity: 1,
                      cut_type: p.cut_type, unit: p.unit, image: p.image,
                    });
                  }}
                  style={styles.rowAdd}
                >
                  <Ionicons name="add" size={20} color={theme.colors.onBrand} />
                </Pressable>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      {cartCount > 0 && <FloatingCartFab onPress={() => router.push("/(tabs)/cart")} />}
    </View>
  );
}

function ProductCardBig({ product, onOpen, onAdd }: { product: Product; onOpen: () => void; onAdd: () => void }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View entering={FadeIn} style={[styles.bigCard, style]}>
      <Pressable
        testID={`product-card-${product.id}`}
        onPress={onOpen}
        onPressIn={() => (scale.value = withSpring(0.97))}
        onPressOut={() => (scale.value = withSpring(1))}
        style={{ flex: 1 }}
      >
        <Image source={{ uri: product.image }} style={styles.bigImg} contentFit="cover" />
        <View style={{ padding: theme.spacing.md }}>
          <Text numberOfLines={1} style={styles.bigName}>{product.name}</Text>
          <Text style={styles.bigMeta}>{product.unit}</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.bigPrice}>₹{product.price}</Text>
            <Pressable testID={`add-${product.id}`} onPress={onAdd} style={styles.bigAdd}>
              <Ionicons name="add" size={20} color={theme.colors.onBrand} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function FloatingCartFab({ onPress }: { onPress: () => void }) {
  const { cartCount, cartTotal } = useApp();
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withSpring(1.15, { damping: 5, stiffness: 220 }, () => { scale.value = withSpring(1); });
  }, [cartCount, scale]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[styles.fab, st]}>
      <Pressable testID="floating-cart-fab" onPress={onPress} style={styles.fabInner}>
        <Ionicons name="basket" size={22} color={theme.colors.onBrand} />
        <View style={{ marginLeft: 10 }}>
          <Text style={styles.fabTxt}>{cartCount} item{cartCount > 1 ? "s" : ""}</Text>
          <Text style={styles.fabPrice}>₹{cartTotal.toFixed(0)}</Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color={theme.colors.onBrand} style={{ marginLeft: 12 }} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 220, overflow: "hidden", paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl, marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.lg, borderRadius: theme.radius.lg, ...theme.shadow.md },
  heroContent: { flex: 1, justifyContent: "flex-end", paddingBottom: 4 },
  heroTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroHi: { color: "#fff", fontSize: 13, opacity: 0.9 },
  heroLoc: { color: "#fff", fontSize: 12, marginTop: 4 },
  heroIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.2)", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)" },
  heroTitle: { color: "#fff", fontSize: 26, fontWeight: "700", lineHeight: 32, marginBottom: 12 },

  brandHeader: { backgroundColor: theme.colors.surface, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md, alignItems: "center" },
  brandTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: theme.spacing.sm },
  brandMenuBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surface2, ...theme.shadow.sm },
  locPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.colors.brandTint, paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.pill },
  locTxt: { fontSize: 11, fontWeight: "600", color: theme.colors.brand },
  brandLogo: { width: 260, height: 110, marginTop: theme.spacing.xs },
  brandGreet: { fontSize: 13, color: theme.colors.onSurfaceMuted, marginTop: -8, marginBottom: theme.spacing.sm, textAlign: "center" },
  heroCta: { alignSelf: "flex-start", backgroundColor: "#fff", paddingHorizontal: 18, paddingVertical: 12, borderRadius: theme.radius.pill, flexDirection: "row", alignItems: "center", gap: 8, ...theme.shadow.md },
  heroCtaText: { color: theme.colors.onSurface, fontWeight: "600", fontSize: 14 },

  section: { marginTop: theme.spacing.xl },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: theme.colors.onSurface, paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.md },
  link: { color: theme.colors.brand, fontWeight: "600", fontSize: 13 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: theme.spacing.lg },

  catGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md },
  catCard: { width: "47%", height: 120, borderRadius: theme.radius.lg, overflow: "hidden", justifyContent: "flex-end", padding: theme.spacing.md, ...theme.shadow.sm },
  catEmoji: { fontSize: 28, position: "absolute", top: 10, right: 12 },
  catLabel: { color: "#fff", fontWeight: "700", fontSize: 16 },

  bigCard: { width: 175, backgroundColor: theme.colors.surface2, borderRadius: theme.radius.lg, overflow: "hidden", ...theme.shadow.sm },
  bigImg: { width: "100%", height: 130 },
  bigName: { color: theme.colors.onSurface, fontWeight: "700", fontSize: 14 },
  bigMeta: { color: theme.colors.onSurfaceMuted, fontSize: 12, marginTop: 2, marginBottom: 8 },
  bigPrice: { color: theme.colors.onSurface, fontWeight: "700", fontSize: 16 },
  bigAdd: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center" },

  rowCard: { flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.surface2, borderRadius: theme.radius.lg, padding: theme.spacing.sm, gap: theme.spacing.md, ...theme.shadow.sm },
  rowImg: { width: 68, height: 68, borderRadius: theme.radius.md },
  rowName: { color: theme.colors.onSurface, fontWeight: "700", fontSize: 15 },
  rowMeta: { color: theme.colors.onSurfaceMuted, fontSize: 12, textTransform: "capitalize", marginTop: 2 },
  rowPrice: { color: theme.colors.onSurface, fontWeight: "700", fontSize: 15, marginTop: 4 },
  rowAdd: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center" },

  fab: { position: "absolute", left: 20, right: 20, bottom: 96, ...theme.shadow.lg },
  fabInner: { flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.brand, paddingHorizontal: 18, paddingVertical: 14, borderRadius: theme.radius.pill },
  fabTxt: { color: theme.colors.onBrand, fontSize: 12, opacity: 0.85 },
  fabPrice: { color: theme.colors.onBrand, fontWeight: "700", fontSize: 15 },

  subPromo: { height: 130, borderRadius: theme.radius.lg, overflow: "hidden", flexDirection: "row", alignItems: "center", ...theme.shadow.md },
  subBadge: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.22)", paddingHorizontal: 10, paddingVertical: 3, borderRadius: theme.radius.pill, marginBottom: 8 },
  subBadgeTxt: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  subH1: { color: "#fff", fontSize: 20, fontWeight: "700", lineHeight: 24 },
  subArrowRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  subCta: { color: "#fff", fontSize: 13, fontWeight: "600" },
  subEmoji: { fontSize: 80, marginRight: -10, opacity: 0.4 },
});
