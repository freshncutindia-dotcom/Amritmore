import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { theme } from "@/src/theme";
import { apiFetch } from "@/src/api";
import { sx } from "./adminStyles";

export default function AdminDeals() {
  const [deals, setDeals] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dProduct, setDProduct] = useState("");
  const [dPct, setDPct] = useState("20");
  const [dBanner, setDBanner] = useState("");

  const load = useCallback(async () => {
    const [dl, pr] = await Promise.all([
      apiFetch("/admin/deals").catch(() => []),
      apiFetch("/products?include_unavailable=true").catch(() => []),
    ]);
    setDeals(dl);
    setProducts(pr);
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const addDeal = async () => {
    if (!dProduct || !dPct) return;
    await apiFetch("/admin/deals", {
      method: "POST",
      body: JSON.stringify({ product_id: dProduct, discount_pct: Number(dPct), banner_text: dBanner || null }),
    });
    setDBanner("");
    load();
  };

  const delDeal = async (id: string) => { await apiFetch(`/admin/deals/${id}`, { method: "DELETE" }); load(); };
  const toggleDeal = async (id: string, active: boolean) => {
    await apiFetch(`/admin/deals/${id}?active=${active ? "false" : "true"}`, { method: "PATCH" });
    load();
  };

  if (loading) return <ActivityIndicator color={theme.colors.brand} style={{ marginTop: 40 }} />;

  return (
    <ScrollView contentContainerStyle={sx.scroll}>
      <View style={sx.card}>
        <Text style={sx.formTitle}>Create daily deal</Text>
        <Text style={sx.mini}>Product</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
          {products.slice(0, 40).map((p) => (
            <Pressable key={p.id} testID={`admin-d-product-${p.id}`} onPress={() => setDProduct(p.id)} style={[sx.chip, dProduct === p.id && sx.chipActive]}>
              <Text numberOfLines={1} style={[sx.chipTxt, dProduct === p.id && sx.chipTxtActive]}>{p.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={sx.mini}>Discount %</Text>
        <TextInput testID="admin-d-pct" placeholder="e.g. 20" placeholderTextColor={theme.colors.onSurfaceMuted} keyboardType="numeric" maxLength={2} style={sx.input} value={dPct} onChangeText={setDPct} />
        <TextInput testID="admin-d-banner" placeholder="Banner text (optional)" placeholderTextColor={theme.colors.onSurfaceMuted} style={sx.input} value={dBanner} onChangeText={setDBanner} />
        <Pressable testID="admin-d-submit" onPress={addDeal} disabled={!dProduct || !dPct} style={[sx.submit, (!dProduct || !dPct) && { opacity: 0.5 }]}>
          <Text style={sx.submitTxt}>+ Publish deal</Text>
        </Pressable>
      </View>

      {deals.map((d, i) => (
        <Animated.View key={d.id} entering={FadeInDown.delay(i * 20)} style={sx.item}>
          <View style={{ flex: 1 }}>
            <Text style={sx.itemName}>{d.product_name}</Text>
            <Text style={sx.itemMeta}>
              {d.discount_pct}% off · ₹{Math.round(d.deal_price)}{" "}
              <Text style={{ textDecorationLine: "line-through", color: theme.colors.onSurfaceMuted }}>₹{Math.round(d.original_price)}</Text>
              {d.active ? " · LIVE" : " · PAUSED"}
            </Text>
          </View>
          <Pressable testID={`admin-toggle-${d.id}`} onPress={() => toggleDeal(d.id, d.active)} style={[sx.iconBtn, { marginRight: 8 }]}>
            <Ionicons name={d.active ? "pause" : "play"} size={16} color={theme.colors.brandDark} />
          </Pressable>
          <Pressable testID={`admin-del-deal-${d.id}`} onPress={() => delDeal(d.id)} style={sx.delBtn}>
            <Ionicons name="trash" size={16} color={theme.colors.error} />
          </Pressable>
        </Animated.View>
      ))}
    </ScrollView>
  );
}
