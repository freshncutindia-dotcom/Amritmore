import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { theme, CATEGORIES, CUT_TYPES } from "@/src/theme";
import { apiFetch } from "@/src/api";
import { useApp } from "@/src/store";

export default function Admin() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useApp();
  const [tab, setTab] = useState<"products" | "pincodes" | "deals">("products");
  const [products, setProducts] = useState<any[]>([]);
  const [pincodes, setPincodes] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // product form
  const [pName, setPName] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pPrice, setPPrice] = useState("");
  const [pCategory, setPCategory] = useState<string>("cut-veg");
  const [pCut, setPCut] = useState<string>("sliced");
  const [pImage, setPImage] = useState("");
  const [pUnit, setPUnit] = useState("500g");

  // pincode form
  const [pin, setPin] = useState("");
  const [area, setArea] = useState("");
  const [fee, setFee] = useState("0");

  // deal form
  const [dProduct, setDProduct] = useState<string>("");
  const [dPct, setDPct] = useState("20");
  const [dBanner, setDBanner] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [pr, pc, dl] = await Promise.all([
      apiFetch("/products"),
      apiFetch("/pincodes"),
      apiFetch("/admin/deals").catch(() => []),
    ]);
    setProducts(pr);
    setPincodes(pc);
    setDeals(dl);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!user || user.role !== "admin") {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface, padding: 40, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="lock-closed" size={40} color={theme.colors.onSurfaceMuted} />
        <Text style={{ fontSize: 16, color: theme.colors.onSurface, marginTop: 12 }}>Admin access only</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 20, backgroundColor: theme.colors.brand, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 }}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const addProduct = async () => {
    if (!pName || !pPrice || !pImage) return;
    await apiFetch("/products", {
      method: "POST",
      body: JSON.stringify({
        name: pName, description: pDesc || "Fresh produce", category: pCategory, cut_type: pCut,
        price: Number(pPrice), unit: pUnit, image: pImage, stock: 50, tags: [],
      }),
    });
    setPName(""); setPDesc(""); setPPrice(""); setPImage("");
    load();
  };

  const delProduct = async (id: string) => { await apiFetch(`/products/${id}`, { method: "DELETE" }); load(); };

  const addPincode = async () => {
    if (!/^\d{6}$/.test(pin) || !area) return;
    await apiFetch("/pincodes", {
      method: "POST",
      body: JSON.stringify({ pincode: pin, area, delivery_fee: Number(fee), eta_hours: 3 }),
    });
    setPin(""); setArea(""); setFee("0");
    load();
  };

  const delPincode = async (pc: string) => { await apiFetch(`/pincodes/${pc}`, { method: "DELETE" }); load(); };

  const addDeal = async () => {
    if (!dProduct || !dPct) return;
    await apiFetch("/admin/deals", {
      method: "POST",
      body: JSON.stringify({
        product_id: dProduct,
        discount_pct: Number(dPct),
        banner_text: dBanner || null,
      }),
    });
    setDBanner("");
    load();
  };

  const delDeal = async (id: string) => { await apiFetch(`/admin/deals/${id}`, { method: "DELETE" }); load(); };

  const toggleDeal = async (id: string, active: boolean) => {
    await apiFetch(`/admin/deals/${id}?active=${active ? "false" : "true"}`, { method: "PATCH" });
    load();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={22} color={theme.colors.onSurface} /></Pressable>
        <Text style={styles.htitle}>Admin Panel</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabs}>
        <Pressable testID="tab-products" onPress={() => setTab("products")} style={[styles.tab, tab === "products" && styles.tabActive]}>
          <Text style={[styles.tabTxt, tab === "products" && styles.tabTxtActive]}>Products ({products.length})</Text>
        </Pressable>
        <Pressable testID="tab-deals" onPress={() => setTab("deals")} style={[styles.tab, tab === "deals" && styles.tabActive]}>
          <Text style={[styles.tabTxt, tab === "deals" && styles.tabTxtActive]}>Deals ({deals.length})</Text>
        </Pressable>
        <Pressable testID="tab-pincodes" onPress={() => setTab("pincodes")} style={[styles.tab, tab === "pincodes" && styles.tabActive]}>
          <Text style={[styles.tabTxt, tab === "pincodes" && styles.tabTxtActive]}>PINs ({pincodes.length})</Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator color={theme.colors.brand} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100 }}>
          {tab === "products" && (
            <>
              <View style={styles.card}>
                <Text style={styles.formTitle}>Add product</Text>
                <TextInput testID="admin-p-name" placeholder="Name" placeholderTextColor={theme.colors.onSurfaceMuted} style={styles.input} value={pName} onChangeText={setPName} />
                <TextInput placeholder="Description" placeholderTextColor={theme.colors.onSurfaceMuted} style={styles.input} value={pDesc} onChangeText={setPDesc} />
                <TextInput testID="admin-p-price" placeholder="Price (₹)" placeholderTextColor={theme.colors.onSurfaceMuted} keyboardType="numeric" style={styles.input} value={pPrice} onChangeText={setPPrice} />
                <TextInput placeholder="Image URL" placeholderTextColor={theme.colors.onSurfaceMuted} style={styles.input} value={pImage} onChangeText={setPImage} />
                <TextInput placeholder="Unit (250g/500g/1kg)" placeholderTextColor={theme.colors.onSurfaceMuted} style={styles.input} value={pUnit} onChangeText={setPUnit} />
                <Text style={styles.mini}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {CATEGORIES.map((c) => (
                    <Pressable key={c.id} onPress={() => setPCategory(c.id)} style={[styles.chip, pCategory === c.id && styles.chipActive]}>
                      <Text style={[styles.chipTxt, pCategory === c.id && styles.chipTxtActive]}>{c.label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={styles.mini}>Cut type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {CUT_TYPES.filter((c) => c.id !== "all").map((c) => (
                    <Pressable key={c.id} onPress={() => setPCut(c.id)} style={[styles.chip, pCut === c.id && styles.chipActive]}>
                      <Text style={[styles.chipTxt, pCut === c.id && styles.chipTxtActive]}>{c.label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Pressable testID="admin-p-submit" onPress={addProduct} style={styles.submit}>
                  <Text style={styles.submitTxt}>+ Add product</Text>
                </Pressable>
              </View>

              {products.map((p, i) => (
                <Animated.View key={p.id} entering={FadeInDown.delay(i * 20)} style={styles.item}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{p.name}</Text>
                    <Text style={styles.itemMeta}>{p.cut_type} · {p.unit} · ₹{p.price}</Text>
                  </View>
                  <Pressable testID={`admin-del-${p.id}`} onPress={() => delProduct(p.id)} style={styles.delBtn}>
                    <Ionicons name="trash" size={16} color={theme.colors.error} />
                  </Pressable>
                </Animated.View>
              ))}
            </>
          )}

          {tab === "deals" && (
            <>
              <View style={styles.card}>
                <Text style={styles.formTitle}>Create daily deal</Text>
                <Text style={styles.mini}>Product</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                  {products.slice(0, 40).map((p) => (
                    <Pressable
                      key={p.id}
                      testID={`admin-d-product-${p.id}`}
                      onPress={() => setDProduct(p.id)}
                      style={[styles.chip, dProduct === p.id && styles.chipActive]}
                    >
                      <Text numberOfLines={1} style={[styles.chipTxt, dProduct === p.id && styles.chipTxtActive]}>{p.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={styles.mini}>Discount %</Text>
                <TextInput
                  testID="admin-d-pct"
                  placeholder="e.g. 20"
                  placeholderTextColor={theme.colors.onSurfaceMuted}
                  keyboardType="numeric"
                  maxLength={2}
                  style={styles.input}
                  value={dPct}
                  onChangeText={setDPct}
                />
                <TextInput
                  testID="admin-d-banner"
                  placeholder="Banner text (optional, e.g. 'Deal of the day')"
                  placeholderTextColor={theme.colors.onSurfaceMuted}
                  style={styles.input}
                  value={dBanner}
                  onChangeText={setDBanner}
                />
                <Pressable
                  testID="admin-d-submit"
                  onPress={addDeal}
                  disabled={!dProduct || !dPct}
                  style={[styles.submit, (!dProduct || !dPct) && { opacity: 0.5 }]}
                >
                  <Text style={styles.submitTxt}>+ Publish deal</Text>
                </Pressable>
              </View>

              {deals.map((d, i) => (
                <Animated.View key={d.id} entering={FadeInDown.delay(i * 20)} style={styles.item}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{d.product_name}</Text>
                    <Text style={styles.itemMeta}>
                      {d.discount_pct}% off · ₹{Math.round(d.deal_price)} <Text style={{ textDecorationLine: "line-through", color: theme.colors.onSurfaceMuted }}>₹{Math.round(d.original_price)}</Text> {d.active ? "· LIVE" : "· PAUSED"}
                    </Text>
                  </View>
                  <Pressable testID={`admin-toggle-${d.id}`} onPress={() => toggleDeal(d.id, d.active)} style={[styles.delBtn, { backgroundColor: theme.colors.brandTint, marginRight: 8 }]}>
                    <Ionicons name={d.active ? "pause" : "play"} size={16} color={theme.colors.brandDark} />
                  </Pressable>
                  <Pressable testID={`admin-del-deal-${d.id}`} onPress={() => delDeal(d.id)} style={styles.delBtn}>
                    <Ionicons name="trash" size={16} color={theme.colors.error} />
                  </Pressable>
                </Animated.View>
              ))}
            </>
          )}

          {tab === "pincodes" && (
            <>
              <View style={styles.card}>
                <Text style={styles.formTitle}>Add serviceable pincode</Text>
                <TextInput testID="admin-pin-code" placeholder="6-digit pincode" placeholderTextColor={theme.colors.onSurfaceMuted} keyboardType="number-pad" maxLength={6} style={styles.input} value={pin} onChangeText={setPin} />
                <TextInput testID="admin-pin-area" placeholder="Area name" placeholderTextColor={theme.colors.onSurfaceMuted} style={styles.input} value={area} onChangeText={setArea} />
                <TextInput placeholder="Delivery fee (₹)" placeholderTextColor={theme.colors.onSurfaceMuted} keyboardType="numeric" style={styles.input} value={fee} onChangeText={setFee} />
                <Pressable testID="admin-pin-submit" onPress={addPincode} style={styles.submit}>
                  <Text style={styles.submitTxt}>+ Add pincode</Text>
                </Pressable>
              </View>

              {pincodes.map((p, i) => (
                <Animated.View key={p.pincode} entering={FadeInDown.delay(i * 20)} style={styles.item}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{p.pincode}</Text>
                    <Text style={styles.itemMeta}>{p.area} · ETA {p.eta_hours}h · {p.delivery_fee ? `₹${p.delivery_fee}` : "Free"}</Text>
                  </View>
                  <Pressable testID={`admin-del-pin-${p.pincode}`} onPress={() => delPincode(p.pincode)} style={styles.delBtn}>
                    <Ionicons name="trash" size={16} color={theme.colors.error} />
                  </Pressable>
                </Animated.View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.spacing.lg, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surface2 },
  htitle: { fontSize: 18, fontWeight: "700", color: theme.colors.onSurface },
  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: theme.spacing.lg, paddingTop: 12 },
  tab: { flex: 1, height: 40, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surface2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.colors.border },
  tabActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  tabTxt: { fontWeight: "600", color: theme.colors.onSurface, fontSize: 13 },
  tabTxtActive: { color: theme.colors.onBrand },

  card: { backgroundColor: theme.colors.surface2, borderRadius: theme.radius.lg, padding: theme.spacing.md, gap: 10, marginBottom: theme.spacing.lg, ...theme.shadow.sm },
  formTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.onSurface, marginBottom: 4 },
  input: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, paddingHorizontal: 14, height: 44, color: theme.colors.onSurface, fontSize: 14 },
  mini: { fontSize: 12, fontWeight: "700", color: theme.colors.onSurfaceMuted, marginTop: 4 },
  chip: { paddingHorizontal: 14, height: 32, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, justifyContent: "center" },
  chipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  chipTxt: { fontSize: 12, color: theme.colors.onSurface },
  chipTxtActive: { color: theme.colors.onBrand, fontWeight: "600" },
  submit: { height: 48, borderRadius: theme.radius.pill, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center", marginTop: 6 },
  submitTxt: { color: theme.colors.onBrand, fontWeight: "700" },

  item: { flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.surface2, borderRadius: theme.radius.md, padding: 12, marginBottom: 8, ...theme.shadow.sm },
  itemName: { fontSize: 14, fontWeight: "700", color: theme.colors.onSurface },
  itemMeta: { fontSize: 12, color: theme.colors.onSurfaceMuted, marginTop: 2 },
  delBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#FDECE7", alignItems: "center", justifyContent: "center" },
});
