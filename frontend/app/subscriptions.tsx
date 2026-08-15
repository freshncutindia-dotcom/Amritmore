import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/src/theme";
import { apiFetch } from "@/src/api";
import { useApp } from "@/src/store";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const freqLabel = (s: any) => {
  if (s.frequency === "daily") return "Daily";
  if (s.frequency === "alternate") return "Every 2 days";
  return `Weekly · ${DAYS[s.weekly_day ?? 0]}`;
};

const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toDateString().slice(0, 10);

export default function Subscriptions() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useApp();
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setSubs(await apiFetch("/subscriptions"));
  }, [user]);

  useEffect(() => { load().catch(() => {}).finally(() => setLoading(false)); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load().catch(() => {}); setRefreshing(false); };

  const patch = async (id: string, body: any) => {
    setBusy(id);
    try {
      const updated = await apiFetch(`/subscriptions/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      if (updated.status === "cancelled") setSubs((prev) => prev.filter((s) => s.id !== id));
      else setSubs((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch {}
    setBusy(null); setConfirmCancel(null);
  };

  const skip = async (id: string) => {
    setBusy(id);
    try {
      const updated = await apiFetch(`/subscriptions/${id}/skip`, { method: "POST" });
      setSubs((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch {}
    setBusy(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.onSurface} />
        </Pressable>
        <Text style={styles.htitle}>My Subscriptions</Text>
        <Pressable testID="subs-new" onPress={() => router.push("/subscribe")} style={[styles.back, { backgroundColor: theme.colors.brand }]}>
          <Ionicons name="add" size={22} color={theme.colors.onBrand} />
        </Pressable>
      </View>

      {!user ? (
        <View style={styles.empty}>
          <Ionicons name="lock-closed-outline" size={40} color={theme.colors.onSurfaceMuted} />
          <Text style={styles.emptyTitle}>Sign in to see your subscriptions</Text>
          <Pressable onPress={() => router.push({ pathname: "/otp", params: { redirect: "/subscriptions" } })} style={styles.primaryBtn}>
            <Text style={styles.primaryTxt}>Sign in</Text>
          </Pressable>
        </View>
      ) : loading ? (
        <ActivityIndicator color={theme.colors.brand} style={{ marginTop: 40 }} />
      ) : subs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 52 }}>🔁</Text>
          <Text style={styles.emptyTitle}>No subscriptions yet</Text>
          <Text style={styles.emptyTxt}>Get your favourite veggies & fruits delivered automatically — daily, alternate days or weekly. Pay cash on each delivery.</Text>
          <Pressable testID="subs-create" onPress={() => router.push("/subscribe")} style={styles.primaryBtn}>
            <Text style={styles.primaryTxt}>Create a subscription</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand} />}
        >
          {subs.map((s) => {
            const paused = s.status === "paused";
            const perDelivery = s.items.reduce((t: number, it: any) => t + it.price * it.quantity, 0);
            return (
              <View key={s.id} style={[styles.card, paused && { opacity: 0.75 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={[styles.cardTitle, { flex: 1 }]} numberOfLines={1}>{s.name}</Text>
                  <View style={[styles.pill, { backgroundColor: paused ? "rgba(229,180,114,0.2)" : theme.colors.brandTint }]}>
                    <Text style={[styles.pillTxt, { color: paused ? theme.colors.warning : theme.colors.brandDark }]}>{paused ? "PAUSED" : "ACTIVE"}</Text>
                  </View>
                </View>
                <Text style={styles.meta}>{freqLabel(s)} · {s.items.length} item{s.items.length > 1 ? "s" : ""} · ₹{perDelivery.toFixed(0)}/delivery · COD</Text>
                <Text style={styles.meta} numberOfLines={1}>📍 {s.address} — {s.pincode}</Text>
                <View style={styles.nextRow}>
                  <Ionicons name="calendar-outline" size={15} color={theme.colors.brandDark} />
                  <Text style={styles.nextTxt}>Next delivery: {fmtDate(s.next_delivery_date)}</Text>
                  {s.orders_generated > 0 && <Text style={styles.meta}> · {s.orders_generated} delivered</Text>}
                </View>
                <Text style={styles.itemsTxt} numberOfLines={2}>
                  {s.items.map((it: any) => `${it.name} ×${it.quantity}`).join(", ")}
                </Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                  <Pressable
                    testID={`sub-pause-${s.id}`}
                    disabled={busy === s.id}
                    onPress={() => patch(s.id, { status: paused ? "active" : "paused" })}
                    style={[styles.actBtn, { backgroundColor: theme.colors.brandTint }]}
                  >
                    <Ionicons name={paused ? "play" : "pause"} size={13} color={theme.colors.brandDark} />
                    <Text style={styles.actTxt}>{paused ? "Resume" : "Pause"}</Text>
                  </Pressable>
                  {!paused && (
                    <Pressable testID={`sub-skip-${s.id}`} disabled={busy === s.id} onPress={() => skip(s.id)} style={[styles.actBtn, { backgroundColor: theme.colors.surface3 }]}>
                      <Ionicons name="play-skip-forward" size={13} color={theme.colors.onSurface} />
                      <Text style={[styles.actTxt, { color: theme.colors.onSurface }]}>Skip next</Text>
                    </Pressable>
                  )}
                  <Pressable
                    testID={`sub-cancel-${s.id}`}
                    disabled={busy === s.id}
                    onPress={() => (confirmCancel === s.id ? patch(s.id, { status: "cancelled" }) : setConfirmCancel(s.id))}
                    style={[styles.actBtn, { backgroundColor: "#FDECE7" }]}
                  >
                    <Ionicons name="close" size={13} color={theme.colors.error} />
                    <Text style={[styles.actTxt, { color: theme.colors.error }]}>{confirmCancel === s.id ? "Tap again to confirm" : "Cancel"}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.spacing.lg, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surface2 },
  htitle: { fontSize: 18, fontWeight: "700", color: theme.colors.onSurface },
  card: { backgroundColor: theme.colors.surface2, borderRadius: theme.radius.lg, padding: theme.spacing.md, gap: 6, marginBottom: 12, ...theme.shadow.sm },
  cardTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.onSurface },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill },
  pillTxt: { fontSize: 10, fontWeight: "800" },
  meta: { fontSize: 12, color: theme.colors.onSurfaceMuted },
  nextRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  nextTxt: { fontSize: 13, fontWeight: "700", color: theme.colors.brandDark },
  itemsTxt: { fontSize: 12, color: theme.colors.onSurface, marginTop: 2 },
  actBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 34, borderRadius: theme.radius.pill },
  actTxt: { fontSize: 12, fontWeight: "700", color: theme.colors.brandDark },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: theme.colors.onSurface },
  emptyTxt: { fontSize: 13, color: theme.colors.onSurfaceMuted, textAlign: "center", lineHeight: 20 },
  primaryBtn: { height: 48, paddingHorizontal: 28, borderRadius: theme.radius.pill, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center" },
  primaryTxt: { color: theme.colors.onBrand, fontWeight: "700" },
});
