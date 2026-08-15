import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/src/theme";
import { useApp } from "@/src/store";
import AdminOverview from "@/src/components/admin/AdminOverview";
import AdminOrders from "@/src/components/admin/AdminOrders";
import AdminProducts from "@/src/components/admin/AdminProducts";
import AdminDeals from "@/src/components/admin/AdminDeals";
import AdminPincodes from "@/src/components/admin/AdminPincodes";
import AdminInbox from "@/src/components/admin/AdminInbox";

type TabId = "overview" | "orders" | "products" | "deals" | "pincodes" | "inbox";

const TABS: { id: TabId; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "overview", label: "Dashboard", icon: "grid-outline" },
  { id: "orders", label: "Orders", icon: "receipt-outline" },
  { id: "products", label: "Products", icon: "leaf-outline" },
  { id: "deals", label: "Deals", icon: "pricetag-outline" },
  { id: "pincodes", label: "PINs", icon: "location-outline" },
  { id: "inbox", label: "Inbox", icon: "mail-outline" },
];

export default function Admin() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useApp();
  const [tab, setTab] = useState<TabId>("overview");

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

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.onSurface} />
        </Pressable>
        <Text style={styles.htitle}>Admin Panel</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: theme.spacing.lg }}>
          {TABS.map((t) => (
            <Pressable key={t.id} testID={`tab-${t.id}`} onPress={() => setTab(t.id)} style={[styles.tab, tab === t.id && styles.tabActive]}>
              <Ionicons name={t.icon} size={15} color={tab === t.id ? theme.colors.onBrand : theme.colors.onSurface} />
              <Text style={[styles.tabTxt, tab === t.id && styles.tabTxtActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={{ flex: 1 }}>
        {tab === "overview" && <AdminOverview goTo={(t) => setTab(t as TabId)} />}
        {tab === "orders" && <AdminOrders />}
        {tab === "products" && <AdminProducts />}
        {tab === "deals" && <AdminDeals />}
        {tab === "pincodes" && <AdminPincodes />}
        {tab === "inbox" && <AdminInbox />}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.spacing.lg, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surface2 },
  htitle: { fontSize: 18, fontWeight: "700", color: theme.colors.onSurface },
  tabBar: { paddingVertical: 10 },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, height: 38, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.border },
  tabActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  tabTxt: { fontWeight: "600", color: theme.colors.onSurface, fontSize: 13 },
  tabTxtActive: { color: theme.colors.onBrand },
});
