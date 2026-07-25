import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/src/theme";
import { useApp } from "@/src/store";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, cartCount } = useApp();

  const rows = user
    ? [
        { icon: "gift-outline" as const, label: "Subscribe & Save", tid: "profile-subscribe", onPress: () => router.push("/subscribe"), accent: true },
        { icon: "receipt-outline" as const, label: "My Orders", tid: "profile-orders", onPress: () => router.push("/orders") },
        { icon: "location-outline" as const, label: "Serviceable Pincodes", tid: "profile-pincodes", onPress: () => router.push({ pathname: "/(tabs)/cart" }) },
        ...(user.role === "admin" ? [{ icon: "shield-checkmark-outline" as const, label: "Admin Panel", tid: "profile-admin", onPress: () => router.push("/admin") }] : []),
        { icon: "log-out-outline" as const, label: "Sign out", tid: "profile-signout", onPress: async () => { await logout(); router.replace("/(tabs)"); }, danger: true },
      ]
    : [
        { icon: "gift-outline" as const, label: "Subscribe & Save", tid: "profile-subscribe", onPress: () => router.push("/subscribe"), accent: true },
      ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {user ? (
          <View style={styles.card}>
            <View style={styles.avatar}><Text style={styles.avatarTxt}>{user.name.charAt(0).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{user.name}</Text>
              <Text style={styles.email}>{user.email}</Text>
              {user.role === "admin" && <View style={styles.roleBadge}><Text style={styles.roleTxt}>ADMIN</Text></View>}
            </View>
          </View>
        ) : (
          <View style={styles.guestCard}>
            <Text style={styles.guestTitle}>Welcome, guest 👋</Text>
            <Text style={styles.guestTxt}>Sign in to view orders, track deliveries and save your addresses.</Text>
            <Pressable testID="signin-cta" style={styles.signInBtn} onPress={() => router.push("/auth")}>
              <Text style={styles.signInTxt}>Sign in / Create account</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statNum}>{cartCount}</Text><Text style={styles.statLbl}>In basket</Text></View>
          <View style={styles.stat}><Text style={styles.statNum}>🥕</Text><Text style={styles.statLbl}>Fresh daily</Text></View>
          <View style={styles.stat}><Text style={styles.statNum}>2h</Text><Text style={styles.statLbl}>Fast delivery</Text></View>
        </View>

        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          {rows.map((r) => (
            <Pressable
              key={r.label}
              testID={r.tid}
              onPress={r.onPress}
              style={[styles.row, r.accent && styles.rowAccent]}
            >
              <Ionicons name={r.icon} size={20} color={r.danger ? theme.colors.error : r.accent ? theme.colors.accent : theme.colors.onSurface} />
              <Text style={[styles.rowTxt, r.danger && { color: theme.colors.error }, r.accent && { color: theme.colors.accent, fontWeight: "700" }]}>{r.label}</Text>
              {r.accent && <View style={styles.newPill}><Text style={styles.newPillTxt}>NEW</Text></View>}
              <Ionicons name="chevron-forward" size={18} color={theme.colors.onSurfaceMuted} />
            </Pressable>
          ))}
        </View>

        <Text style={styles.footer}>Freshncut · The Salads & Pre-cut FNVs 🌱</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: theme.spacing.lg, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: "700", color: theme.colors.onSurface },
  card: { flexDirection: "row", alignItems: "center", marginHorizontal: theme.spacing.lg, backgroundColor: theme.colors.surface2, padding: theme.spacing.lg, borderRadius: theme.radius.lg, gap: theme.spacing.md, ...theme.shadow.sm },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontSize: 24, fontWeight: "700" },
  name: { fontSize: 18, fontWeight: "700", color: theme.colors.onSurface },
  email: { fontSize: 13, color: theme.colors.onSurfaceMuted, marginTop: 2 },
  roleBadge: { alignSelf: "flex-start", marginTop: 6, backgroundColor: theme.colors.accent, paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.sm },
  roleTxt: { color: "#fff", fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  guestCard: { marginHorizontal: theme.spacing.lg, backgroundColor: theme.colors.brandTint, padding: theme.spacing.xl, borderRadius: theme.radius.lg, ...theme.shadow.sm },
  guestTitle: { fontSize: 18, fontWeight: "700", color: theme.colors.onSurface, marginBottom: 6 },
  guestTxt: { color: theme.colors.onSurfaceMuted, fontSize: 13, marginBottom: 16 },
  signInBtn: { backgroundColor: theme.colors.brand, height: 48, borderRadius: theme.radius.pill, alignItems: "center", justifyContent: "center" },
  signInTxt: { color: theme.colors.onBrand, fontWeight: "700" },
  stats: { flexDirection: "row", padding: theme.spacing.lg, gap: 12 },
  stat: { flex: 1, backgroundColor: theme.colors.surface2, borderRadius: theme.radius.md, padding: 16, alignItems: "center", ...theme.shadow.sm },
  statNum: { fontSize: 22, fontWeight: "700", color: theme.colors.brand },
  statLbl: { fontSize: 11, color: theme.colors.onSurfaceMuted, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, backgroundColor: theme.colors.surface2, borderRadius: theme.radius.md, marginBottom: 8, ...theme.shadow.sm },
  rowAccent: { backgroundColor: "rgba(217,93,57,0.08)", borderWidth: 1, borderColor: theme.colors.accent },
  rowTxt: { flex: 1, fontSize: 15, color: theme.colors.onSurface, fontWeight: "500" },
  newPill: { backgroundColor: theme.colors.accent, paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radius.sm },
  newPillTxt: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  footer: { textAlign: "center", color: theme.colors.onSurfaceMuted, fontSize: 12, marginTop: theme.spacing.xxl },
});
