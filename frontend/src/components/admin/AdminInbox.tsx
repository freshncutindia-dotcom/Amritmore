import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "@/src/theme";
import { apiFetch } from "@/src/api";
import { sx } from "./adminStyles";

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1} · ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function AdminInbox() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setMessages(await apiFetch("/admin/messages"));
  }, []);

  useEffect(() => { load().catch(() => {}).finally(() => setLoading(false)); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load().catch(() => {}); setRefreshing(false); };

  const markRead = async (id: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, read: true } : m)));
    await apiFetch(`/admin/messages/${id}/read`, { method: "PATCH" }).catch(() => load());
  };

  const del = async (id: string) => {
    await apiFetch(`/admin/messages/${id}`, { method: "DELETE" });
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  if (loading) return <ActivityIndicator color={theme.colors.brand} style={{ marginTop: 40 }} />;

  return (
    <ScrollView
      contentContainerStyle={sx.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand} />}
    >
      {messages.length === 0 && (
        <View style={styles.empty}>
          <Ionicons name="mail-open-outline" size={36} color={theme.colors.onSurfaceMuted} />
          <Text style={styles.emptyTxt}>No customer messages yet</Text>
          <Text style={[styles.emptyTxt, { fontSize: 12 }]}>Messages sent via &quot;Contact Support&quot; appear here and are emailed to you.</Text>
        </View>
      )}
      {messages.map((m) => (
        <View key={m.id} style={[styles.msgCard, !m.read && styles.unread]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {!m.read && <View style={styles.dot} />}
            <Text style={[sx.itemName, { flex: 1 }]} numberOfLines={1}>{m.subject}</Text>
            <Text style={sx.itemMeta}>{fmtDate(m.created_at)}</Text>
          </View>
          <Text style={styles.msgBody}>{m.message}</Text>
          <Text style={sx.itemMeta}>
            {m.user_name || m.user_email}{m.mobile ? ` · 📞 ${m.mobile}` : ""} · {m.user_email}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            {!m.read && (
              <Pressable testID={`msg-read-${m.id}`} onPress={() => markRead(m.id)} style={styles.readBtn}>
                <Ionicons name="checkmark-done" size={14} color={theme.colors.brandDark} />
                <Text style={styles.readTxt}>Mark read</Text>
              </Pressable>
            )}
            <Pressable testID={`msg-del-${m.id}`} onPress={() => del(m.id)} style={sx.delBtn}>
              <Ionicons name="trash" size={15} color={theme.colors.error} />
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  msgCard: { backgroundColor: theme.colors.surface2, borderRadius: theme.radius.lg, padding: 14, marginBottom: 10, gap: 6, ...theme.shadow.sm },
  unread: { borderWidth: 1, borderColor: theme.colors.brand },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.brand },
  msgBody: { fontSize: 13, color: theme.colors.onSurface, lineHeight: 19 },
  readBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: theme.colors.brandTint, paddingHorizontal: 12, height: 36, borderRadius: theme.radius.pill },
  readTxt: { fontSize: 12, fontWeight: "700", color: theme.colors.brandDark },
  empty: { alignItems: "center", paddingTop: 60, gap: 10, paddingHorizontal: 30 },
  emptyTxt: { color: theme.colors.onSurfaceMuted, fontSize: 14, textAlign: "center" },
});
