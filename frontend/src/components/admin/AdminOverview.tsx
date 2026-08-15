import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, RefreshControl, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "@/src/theme";
import { apiFetch } from "@/src/api";
import { sx } from "./adminStyles";

function Stat({ label, value, icon, color, onPress, testID }: { label: string; value: string | number; icon: any; color: string; onPress?: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} disabled={!onPress} style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.statNum}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </Pressable>
  );
}

export default function AdminOverview({ goTo }: { goTo: (tab: string) => void }) {
  const [stats, setStats] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ txt: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [s, st] = await Promise.all([apiFetch("/admin/stats"), apiFetch("/admin/settings")]);
    setStats(s);
    setEmail(st.notify_email);
  }, []);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load().catch(() => {}); setRefreshing(false); };

  const saveEmail = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await apiFetch("/admin/settings", { method: "PUT", body: JSON.stringify({ notify_email: email.trim() }) });
      setMsg({ txt: `Saved — notifications go to ${r.notify_email}`, ok: true });
    } catch (e: any) { setMsg({ txt: e.message, ok: false }); }
    setBusy(false);
  };

  const sendTest = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await apiFetch("/admin/settings/test-email", { method: "POST" });
      setMsg({ txt: `Test email sent to ${r.to} ✓`, ok: true });
    } catch (e: any) { setMsg({ txt: e.message, ok: false }); }
    setBusy(false);
  };

  if (!stats) return <ActivityIndicator color={theme.colors.brand} style={{ marginTop: 40 }} />;

  return (
    <ScrollView contentContainerStyle={sx.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand} />}>
      {stats.unread_messages > 0 && (
        <Pressable testID="ov-inbox-banner" onPress={() => goTo("inbox")} style={styles.banner}>
          <Ionicons name="mail-unread" size={18} color={theme.colors.accent} />
          <Text style={styles.bannerTxt}>{stats.unread_messages} unread customer message{stats.unread_messages > 1 ? "s" : ""}</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.onSurfaceMuted} />
        </Pressable>
      )}

      <View style={styles.grid}>
        <Stat testID="ov-orders-today" label="Orders today" value={stats.orders_today} icon="receipt" color={theme.colors.brand} onPress={() => goTo("orders")} />
        <Stat testID="ov-revenue-today" label="Revenue today" value={`₹${Math.round(stats.revenue_today)}`} icon="cash" color={theme.colors.success} />
        <Stat testID="ov-pending" label="Open orders" value={stats.pending_orders} icon="time" color={theme.colors.warning} onPress={() => goTo("orders")} />
        <Stat testID="ov-low-stock" label="Low stock" value={stats.low_stock_count} icon="alert-circle" color={theme.colors.error} onPress={() => goTo("products")} />
        <Stat label="Total orders" value={stats.total_orders} icon="albums" color={theme.colors.brandDark} />
        <Stat label="Total revenue" value={`₹${Math.round(stats.revenue_total)}`} icon="trending-up" color={theme.colors.success} />
        <Stat label="Products" value={stats.total_products} icon="leaf" color={theme.colors.brand} onPress={() => goTo("products")} />
        <Stat label="Customers" value={stats.total_users} icon="people" color={theme.colors.accent} />
      </View>

      {stats.low_stock?.length > 0 && (
        <View style={sx.card}>
          <Text style={sx.formTitle}>⚠️ Low stock alerts</Text>
          {stats.low_stock.map((p: any) => (
            <Pressable key={p.id} onPress={() => goTo("products")} style={styles.lowRow}>
              <Text style={[sx.itemName, { flex: 1 }]} numberOfLines={1}>{p.name}</Text>
              <Text style={[styles.lowStockTxt, p.stock === 0 && { color: theme.colors.error }]}>{p.stock === 0 ? "OUT" : `${p.stock} left`}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={sx.card}>
        <Text style={sx.formTitle}>📧 Notification email</Text>
        <Text style={sx.itemMeta}>New orders & customer messages are emailed here.</Text>
        <TextInput
          testID="ov-notify-email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="admin@example.com"
          placeholderTextColor={theme.colors.onSurfaceMuted}
          style={sx.input}
        />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable testID="ov-save-email" onPress={saveEmail} disabled={busy} style={[sx.submit, { flex: 1 }, busy && { opacity: 0.5 }]}>
            <Text style={sx.submitTxt}>Save</Text>
          </Pressable>
          <Pressable testID="ov-test-email" onPress={sendTest} disabled={busy} style={[sx.submit, styles.testBtn, busy && { opacity: 0.5 }]}>
            <Text style={[sx.submitTxt, { color: theme.colors.brandDark }]}>Send test email</Text>
          </Pressable>
        </View>
        {msg && <Text testID="ov-email-status" style={msg.ok ? sx.statusOk : sx.statusErr}>{msg.txt}</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: theme.spacing.lg },
  stat: { width: "48%", flexGrow: 1, backgroundColor: theme.colors.surface2, borderRadius: theme.radius.lg, padding: 14, ...theme.shadow.sm },
  statIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  statNum: { fontSize: 20, fontWeight: "800", color: theme.colors.onSurface },
  statLbl: { fontSize: 11, color: theme.colors.onSurfaceMuted, marginTop: 2 },
  banner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(241,162,107,0.14)", borderWidth: 1, borderColor: theme.colors.accent, borderRadius: theme.radius.md, padding: 14, marginBottom: theme.spacing.lg },
  bannerTxt: { flex: 1, fontSize: 13, fontWeight: "700", color: theme.colors.onSurface },
  lowRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  lowStockTxt: { fontSize: 12, fontWeight: "800", color: theme.colors.warning },
  testBtn: { flex: 1, backgroundColor: theme.colors.brandTint },
});
