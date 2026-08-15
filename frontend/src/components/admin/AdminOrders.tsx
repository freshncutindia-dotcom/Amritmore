import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "@/src/theme";
import { apiFetch } from "@/src/api";
import { sx } from "./adminStyles";

const FILTERS = ["all", "pending", "confirmed", "packed", "out-for-delivery", "delivered", "cancelled"];
const NEXT: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  paid: ["confirmed", "cancelled"],
  confirmed: ["packed", "cancelled"],
  packed: ["out-for-delivery", "cancelled"],
  "out-for-delivery": ["delivered"],
  delivered: [],
  cancelled: [],
};
const COLORS: Record<string, string> = {
  pending: theme.colors.warning,
  paid: theme.colors.success,
  confirmed: theme.colors.brand,
  packed: theme.colors.accent,
  "out-for-delivery": theme.colors.brandDark,
  delivered: theme.colors.success,
  cancelled: theme.colors.error,
};
const LABELS: Record<string, string> = {
  confirmed: "Confirm",
  packed: "Mark packed",
  "out-for-delivery": "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancel",
};

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1} · ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async (f: string) => {
    const data = await apiFetch(`/admin/orders?status=${f}&limit=100`);
    setOrders(data);
  }, []);

  useEffect(() => {
    setLoading(true);
    load(filter).catch(() => {}).finally(() => setLoading(false));
  }, [filter, load]);

  const onRefresh = async () => { setRefreshing(true); await load(filter).catch(() => {}); setRefreshing(false); };

  const setStatus = async (id: string, status: string) => {
    setUpdating(id);
    try {
      const updated = await apiFetch(`/admin/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)).filter((o) => filter === "all" || o.status === filter));
    } catch {}
    setUpdating(null);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingVertical: 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: theme.spacing.lg }}>
          {FILTERS.map((f) => (
            <Pressable key={f} testID={`orders-filter-${f}`} onPress={() => setFilter(f)} style={[sx.chip, filter === f && sx.chipActive]}>
              <Text style={[sx.chipTxt, filter === f && sx.chipTxtActive]}>{f === "all" ? "All" : f}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? <ActivityIndicator color={theme.colors.brand} style={{ marginTop: 40 }} /> : (
        <ScrollView
          contentContainerStyle={[sx.scroll, { paddingTop: 4 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand} />}
        >
          {orders.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={36} color={theme.colors.onSurfaceMuted} />
              <Text style={styles.emptyTxt}>No {filter === "all" ? "" : filter + " "}orders yet</Text>
            </View>
          )}
          {orders.map((o) => {
            const isOpen = expanded === o.id;
            const actions = NEXT[o.status] || [];
            return (
              <View key={o.id} style={styles.orderCard}>
                <Pressable testID={`order-card-${o.id}`} onPress={() => setExpanded(isOpen ? null : o.id)} style={styles.orderHead}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={sx.itemName}>#{o.id.slice(0, 8)}</Text>
                      {o.source === "subscription" && (
                        <View style={[styles.pill, { backgroundColor: "rgba(241,162,107,0.2)" }]}>
                          <Text style={[styles.pillTxt, { color: theme.colors.accent }]}>🔁 sub</Text>
                        </View>
                      )}
                      <View style={[styles.pill, { backgroundColor: `${COLORS[o.status]}22` }]}>
                        <Text style={[styles.pillTxt, { color: COLORS[o.status] }]}>{o.status}</Text>
                      </View>
                    </View>
                    <Text style={sx.itemMeta}>
                      {fmtDate(o.created_at)} · {o.items.length} item{o.items.length > 1 ? "s" : ""} · ₹{Math.round(o.total)} · {o.payment_method.toUpperCase()}
                      {o.payment_status === "paid" ? " ✓ paid" : ""}
                    </Text>
                    <Text style={sx.itemMeta} numberOfLines={1}>{o.user_email} · 📞 {o.phone}</Text>
                  </View>
                  <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={theme.colors.onSurfaceMuted} />
                </Pressable>

                {isOpen && (
                  <View style={styles.orderBody}>
                    {o.items.map((it: any, i: number) => (
                      <View key={i} style={styles.itemRow}>
                        <Text style={[sx.itemMeta, { flex: 1, color: theme.colors.onSurface }]} numberOfLines={1}>
                          {it.name} <Text style={{ color: theme.colors.onSurfaceMuted }}>({it.cut_type} · {it.unit})</Text>
                        </Text>
                        <Text style={sx.itemMeta}>×{it.quantity} · ₹{Math.round(it.price * it.quantity)}</Text>
                      </View>
                    ))}
                    <Text style={[sx.itemMeta, { marginTop: 6 }]}>📍 {o.address} — {o.pincode}</Text>
                    {o.delivery_slot_label && <Text style={sx.itemMeta}>🚚 {o.delivery_slot_label}</Text>}
                    <Text style={sx.itemMeta}>Subtotal ₹{Math.round(o.subtotal)} · Fees ₹{Math.round((o.delivery_fee || 0) + (o.handling_fee || 0))} · Total ₹{Math.round(o.total)}</Text>
                  </View>
                )}

                {actions.length > 0 && (
                  <View style={styles.actions}>
                    {actions.map((a) => (
                      <Pressable
                        key={a}
                        testID={`order-action-${o.id}-${a}`}
                        onPress={() => setStatus(o.id, a)}
                        disabled={updating === o.id}
                        style={[styles.actionBtn, a === "cancelled" ? styles.cancelBtn : { backgroundColor: theme.colors.brand }, updating === o.id && { opacity: 0.5 }]}
                      >
                        <Text style={[styles.actionTxt, a === "cancelled" && { color: theme.colors.error }]}>{LABELS[a]}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  orderCard: { backgroundColor: theme.colors.surface2, borderRadius: theme.radius.lg, marginBottom: 10, ...theme.shadow.sm, overflow: "hidden" },
  orderHead: { flexDirection: "row", alignItems: "center", padding: 14, gap: 8 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radius.pill },
  pillTxt: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  orderBody: { paddingHorizontal: 14, paddingBottom: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, paddingTop: 8 },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 3 },
  actions: { flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingBottom: 12, flexWrap: "wrap" },
  actionBtn: { paddingHorizontal: 16, height: 36, borderRadius: theme.radius.pill, alignItems: "center", justifyContent: "center" },
  actionTxt: { color: "#fff", fontSize: 12, fontWeight: "700" },
  cancelBtn: { backgroundColor: "#FDECE7" },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTxt: { color: theme.colors.onSurfaceMuted, fontSize: 14 },
});
