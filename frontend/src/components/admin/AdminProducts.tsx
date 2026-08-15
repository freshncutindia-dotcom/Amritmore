import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Switch, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme, CATEGORIES } from "@/src/theme";
import { apiFetch } from "@/src/api";
import { sx } from "./adminStyles";

const WEIGHT_OPTIONS = ["250g", "300g", "500g", "1kg", "2kg"];
const PRECUT = ["cut-veg", "cut-fruit", "ready-mix"];

export default function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [err, setErr] = useState("");

  // add form
  const [aName, setAName] = useState("");
  const [aPrice, setAPrice] = useState("");
  const [aImage, setAImage] = useState("");
  const [aDesc, setADesc] = useState("");
  const [aCategory, setACategory] = useState("cut-veg");
  const [aCuts, setACuts] = useState("sliced, diced");
  const [aWeights, setAWeights] = useState<string[]>(["250g", "500g", "1kg"]);
  const [aStock, setAStock] = useState("50");

  // edit form
  const [eName, setEName] = useState("");
  const [ePrice, setEPrice] = useState("");
  const [eImage, setEImage] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [eCuts, setECuts] = useState("");
  const [eWeights, setEWeights] = useState<string[]>([]);
  const [eStock, setEStock] = useState("");

  const load = useCallback(async () => {
    const data = await apiFetch("/products?include_unavailable=true");
    setProducts(data);
  }, []);

  useEffect(() => { load().catch(() => {}).finally(() => setLoading(false)); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load().catch(() => {}); setRefreshing(false); };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      [p.name, p.local_name, p.sku, p.category].some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [products, search]);

  const addProduct = async () => {
    if (!aName || !aPrice) { setErr("Name and price are required"); return; }
    setErr("");
    try {
      const isPrecut = PRECUT.includes(aCategory);
      const cuts = isPrecut ? aCuts.split(",").map((c) => c.trim()).filter(Boolean) : ["whole"];
      await apiFetch("/products", {
        method: "POST",
        body: JSON.stringify({
          name: aName, description: aDesc || "Fresh produce", category: aCategory,
          cut_type: cuts[0] || "whole", price: Number(aPrice), unit: aWeights[0] || "500g",
          image: aImage || "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80",
          stock: Number(aStock) || 50, tags: [], available_cuts: cuts, available_weights: aWeights,
        }),
      });
      setAName(""); setAPrice(""); setAImage(""); setADesc(""); setShowAdd(false);
      load();
    } catch (e: any) { setErr(e.message); }
  };

  const delProduct = async (id: string) => { await apiFetch(`/products/${id}`, { method: "DELETE" }); load(); };

  const toggleAvail = async (p: any) => {
    const next = !(p.is_available !== false);
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_available: next } : x)));
    try {
      await apiFetch(`/admin/products/${p.id}`, { method: "PATCH", body: JSON.stringify({ is_available: next }) });
    } catch { load(); }
  };

  const adjustStock = async (p: any, delta: number) => {
    try {
      const updated = await apiFetch(`/admin/products/${p.id}/stock`, { method: "PATCH", body: JSON.stringify({ delta }) });
      setProducts((prev) => prev.map((x) => (x.id === p.id ? updated : x)));
    } catch {}
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setEName(p.name); setEPrice(String(p.price)); setEImage(p.image || "");
    setEDesc(p.description || ""); setECuts((p.available_cuts || []).join(", "));
    setEWeights(p.available_weights || []); setEStock(String(p.stock ?? 0));
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      const isPrecut = PRECUT.includes(editing.category);
      const payload: any = {
        name: eName, description: eDesc, price: Number(ePrice), image: eImage,
        stock: Number(eStock), available_weights: eWeights,
      };
      if (isPrecut) {
        const cuts = eCuts.split(",").map((c) => c.trim()).filter(Boolean);
        if (cuts.length) { payload.available_cuts = cuts; payload.cut_type = cuts[0]; }
      }
      const updated = await apiFetch(`/admin/products/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      setProducts((prev) => prev.map((x) => (x.id === editing.id ? updated : x)));
      setEditing(null);
    } catch (e: any) { setErr(e.message); }
  };

  const toggleWeight = (list: string[], setList: (v: string[]) => void, w: string) => {
    setList(list.includes(w) ? list.filter((x) => x !== w) : [...list, w]);
  };

  if (loading) return <ActivityIndicator color={theme.colors.brand} style={{ marginTop: 40 }} />;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={theme.colors.onSurfaceMuted} />
          <TextInput
            testID="prod-search"
            placeholder="Search products…"
            placeholderTextColor={theme.colors.onSurfaceMuted}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
        </View>
        <Pressable testID="prod-add-toggle" onPress={() => setShowAdd((v) => !v)} style={styles.addBtn}>
          <Ionicons name={showAdd ? "close" : "add"} size={22} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[sx.scroll, { paddingTop: 4 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand} />}
      >
        {showAdd && (
          <View style={sx.card}>
            <Text style={sx.formTitle}>Add product</Text>
            <TextInput testID="admin-p-name" placeholder="Name" placeholderTextColor={theme.colors.onSurfaceMuted} style={sx.input} value={aName} onChangeText={setAName} />
            <TextInput placeholder="Description" placeholderTextColor={theme.colors.onSurfaceMuted} style={sx.input} value={aDesc} onChangeText={setADesc} />
            <TextInput testID="admin-p-price" placeholder="Price (₹)" placeholderTextColor={theme.colors.onSurfaceMuted} keyboardType="numeric" style={sx.input} value={aPrice} onChangeText={setAPrice} />
            <TextInput placeholder="Stock" placeholderTextColor={theme.colors.onSurfaceMuted} keyboardType="numeric" style={sx.input} value={aStock} onChangeText={setAStock} />
            <TextInput placeholder="Image URL (optional)" placeholderTextColor={theme.colors.onSurfaceMuted} style={sx.input} value={aImage} onChangeText={setAImage} />
            <Text style={sx.mini}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {CATEGORIES.map((c) => (
                <Pressable key={c.id} onPress={() => setACategory(c.id)} style={[sx.chip, aCategory === c.id && sx.chipActive]}>
                  <Text style={[sx.chipTxt, aCategory === c.id && sx.chipTxtActive]}>{c.short}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {PRECUT.includes(aCategory) && (
              <>
                <Text style={sx.mini}>Cut types (comma separated)</Text>
                <TextInput placeholder="sliced, diced, julienne" placeholderTextColor={theme.colors.onSurfaceMuted} style={sx.input} value={aCuts} onChangeText={setACuts} />
              </>
            )}
            <Text style={sx.mini}>Weights</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {WEIGHT_OPTIONS.map((w) => (
                <Pressable key={w} onPress={() => toggleWeight(aWeights, setAWeights, w)} style={[sx.chip, aWeights.includes(w) && sx.chipActive]}>
                  <Text style={[sx.chipTxt, aWeights.includes(w) && sx.chipTxtActive]}>{w}</Text>
                </Pressable>
              ))}
            </View>
            {!!err && <Text style={sx.statusErr}>{err}</Text>}
            <Pressable testID="admin-p-submit" onPress={addProduct} style={sx.submit}>
              <Text style={sx.submitTxt}>+ Add product</Text>
            </Pressable>
          </View>
        )}

        <Text style={[sx.mini, { marginBottom: 8 }]}>{filtered.length} products</Text>
        {filtered.map((p) => {
          const available = p.is_available !== false;
          const low = (p.stock ?? 0) < 10;
          return (
            <View key={p.id} style={[sx.item, !available && { opacity: 0.55 }]}>
              <View style={{ flex: 1 }}>
                <Text style={sx.itemName} numberOfLines={1}>{p.name}</Text>
                <Text style={sx.itemMeta}>₹{p.price} · {p.unit} · {p.category}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <Pressable testID={`stock-minus-${p.id}`} onPress={() => adjustStock(p, -1)} style={styles.stepBtn}>
                    <Ionicons name="remove" size={16} color={theme.colors.brandDark} />
                  </Pressable>
                  <Text style={[styles.stockTxt, low && { color: p.stock === 0 ? theme.colors.error : theme.colors.warning }]}>
                    {p.stock ?? 0} in stock
                  </Text>
                  <Pressable testID={`stock-plus-${p.id}`} onPress={() => adjustStock(p, 1)} style={styles.stepBtn}>
                    <Ionicons name="add" size={16} color={theme.colors.brandDark} />
                  </Pressable>
                </View>
              </View>
              <View style={{ alignItems: "center", gap: 8 }}>
                <Switch
                  testID={`avail-switch-${p.id}`}
                  value={available}
                  onValueChange={() => toggleAvail(p)}
                  trackColor={{ false: theme.colors.border, true: theme.colors.brand }}
                  thumbColor="#fff"
                />
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Pressable testID={`prod-edit-${p.id}`} onPress={() => openEdit(p)} style={sx.iconBtn}>
                    <Ionicons name="pencil" size={15} color={theme.colors.brandDark} />
                  </Pressable>
                  <Pressable testID={`admin-del-${p.id}`} onPress={() => delProduct(p.id)} style={sx.delBtn}>
                    <Ionicons name="trash" size={15} color={theme.colors.error} />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={!!editing} animationType="slide" transparent onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={sx.formTitle}>Edit {editing?.name}</Text>
              <Pressable testID="edit-close" onPress={() => setEditing(null)} style={sx.iconBtn}>
                <Ionicons name="close" size={18} color={theme.colors.onSurface} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
              <Text style={sx.mini}>Name</Text>
              <TextInput testID="edit-name" style={sx.input} value={eName} onChangeText={setEName} />
              <Text style={sx.mini}>Description</Text>
              <TextInput style={sx.input} value={eDesc} onChangeText={setEDesc} />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={sx.mini}>Price (₹)</Text>
                  <TextInput testID="edit-price" style={sx.input} keyboardType="numeric" value={ePrice} onChangeText={setEPrice} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={sx.mini}>Stock</Text>
                  <TextInput testID="edit-stock" style={sx.input} keyboardType="numeric" value={eStock} onChangeText={setEStock} />
                </View>
              </View>
              <Text style={sx.mini}>Image URL</Text>
              <TextInput style={sx.input} value={eImage} onChangeText={setEImage} autoCapitalize="none" />
              <Text style={sx.mini}>Weights / sizes</Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {[...new Set([...WEIGHT_OPTIONS, ...(editing?.available_weights || [])])].map((w) => (
                  <Pressable key={w} testID={`edit-weight-${w}`} onPress={() => toggleWeight(eWeights, setEWeights, w)} style={[sx.chip, eWeights.includes(w) && sx.chipActive]}>
                    <Text style={[sx.chipTxt, eWeights.includes(w) && sx.chipTxtActive]}>{w}</Text>
                  </Pressable>
                ))}
              </View>
              {editing && PRECUT.includes(editing.category) && (
                <>
                  <Text style={sx.mini}>Cut types (comma separated)</Text>
                  <TextInput testID="edit-cuts" style={sx.input} value={eCuts} onChangeText={setECuts} autoCapitalize="none" />
                </>
              )}
              {!!err && <Text style={sx.statusErr}>{err}</Text>}
              <Pressable testID="edit-save" onPress={saveEdit} style={sx.submit}>
                <Text style={sx.submitTxt}>Save changes</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", gap: 10, paddingHorizontal: theme.spacing.lg, paddingVertical: 10, alignItems: "center" },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.colors.surface2, borderRadius: theme.radius.pill, paddingHorizontal: 14, height: 44, ...theme.shadow.sm },
  searchInput: { flex: 1, color: theme.colors.onSurface, fontSize: 14 },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center", ...theme.shadow.sm },
  stepBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.brandTint, alignItems: "center", justifyContent: "center" },
  stockTxt: { fontSize: 12, fontWeight: "700", color: theme.colors.success, minWidth: 74, textAlign: "center" },
  modalWrap: { flex: 1, backgroundColor: theme.colors.scrim, justifyContent: "flex-end" },
  modalCard: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: theme.spacing.lg, maxHeight: "88%", gap: 10 },
});
