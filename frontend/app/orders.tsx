import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { theme } from "@/src/theme";
import { apiFetch } from "@/src/api";
import { useApp } from "@/src/store";

const STATUS_META: Record<string, { color: string; label: string; icon: any }> = {
  pending: { color: "#F5A623", label: "Pending", icon: "time-outline" },
  paid: { color: "#3A7D44", label: "Paid", icon: "checkmark-circle-outline" },
  confirmed: { color: "#3A7D44", label: "Confirmed", icon: "checkmark-circle-outline" },
  packed: { color: "#4A90E2", label: "Packed", icon: "cube-outline" },
  "out-for-delivery": { color: "#D95D39", label: "Out for delivery", icon: "bicycle-outline" },
  delivered: { color: "#3A7D44", label: "Delivered", icon: "checkmark-done-outline" },
  cancelled: { color: "#D0421B", label: "Cancelled", icon: "close-circle-outline" },
};

export default function Orders() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useApp();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const data = await apiFetch("/orders");
      setOrders(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface, padding: 40, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 16, color: theme.colors.onSurface }}>Please sign in to see your orders</Text>
        <Pressable style={{ marginTop: 20, backgroundColor: theme.colors.brand, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 }} onPress={() => router.replace("/auth")}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={22} color={theme.colors.onSurface} /></Pressable>
        <Text style={styles.htitle}>My Orders</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.brand} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {orders.length === 0 ? (
            <View style={styles.empty}><Text style={{ fontSize: 40 }}>📦</Text><Text style={styles.emptyTxt}>No orders yet</Text></View>
          ) : orders.map((o, i) => {
            const meta = STATUS_META[o.status] || STATUS_META.pending;
            return (
              <Animated.View key={o.id} entering={FadeInDown.delay(i * 40)} style={styles.card} testID={`order-${o.id}`}>
                <View style={styles.cardHead}>
                  <Text style={styles.orderId}>#{o.id.slice(0, 8).toUpperCase()}</Text>
                  <View style={[styles.badge, { backgroundColor: `${meta.color}20` }]}>
                    <Ionicons name={meta.icon} size={12} color={meta.color} />
                    <Text style={[styles.badgeTxt, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
                <View style={styles.imgs}>
                  {o.items.slice(0, 4).map((it: any, k: number) => (
                    <Image key={k} source={{ uri: it.image }} style={styles.thumb} contentFit="cover" />
                  ))}
                  {o.items.length > 4 && <View style={styles.more}><Text style={{ color: "#fff", fontWeight: "700" }}>+{o.items.length - 4}</Text></View>}
                </View>
                <View style={styles.cardFoot}>
                  <View>
                    <Text style={styles.meta}>{o.items.length} items · {o.payment_method === "cod" ? "Cash on Delivery" : "Stripe"}</Text>
                    <Text style={styles.meta}>To {o.pincode}</Text>
                  </View>
                  <Text style={styles.total}>₹{o.total.toFixed(0)}</Text>
                </View>
              </Animated.View>
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
  card: { backgroundColor: theme.colors.surface2, borderRadius: theme.radius.lg, padding: theme.spacing.md, ...theme.shadow.sm },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  orderId: { fontSize: 13, fontWeight: "700", color: theme.colors.onSurface, letterSpacing: 0.5 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill },
  badgeTxt: { fontSize: 11, fontWeight: "700" },
  imgs: { flexDirection: "row", gap: 6, marginBottom: 12 },
  thumb: { width: 52, height: 52, borderRadius: theme.radius.md },
  more: { width: 52, height: 52, borderRadius: theme.radius.md, backgroundColor: theme.colors.onSurface, alignItems: "center", justifyContent: "center" },
  cardFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  meta: { fontSize: 12, color: theme.colors.onSurfaceMuted, marginTop: 2 },
  total: { fontSize: 20, fontWeight: "700", color: theme.colors.brand },
  empty: { alignItems: "center", padding: 60 },
  emptyTxt: { color: theme.colors.onSurfaceMuted, marginTop: 12 },
});
