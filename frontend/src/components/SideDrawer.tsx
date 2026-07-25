import React, { createContext, useContext, useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, Platform, Dimensions, Modal } from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { theme, CATEGORIES } from "@/src/theme";
import { useApp } from "@/src/store";

type DrawerCtx = { open: () => void; close: () => void; visible: boolean };
const Ctx = createContext<DrawerCtx>({ open: () => {}, close: () => {}, visible: false });
export const useDrawer = () => useContext(Ctx);

const { width } = Dimensions.get("window");
const DRAWER_WIDTH = Math.min(width * 0.82, 340);

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  const open = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMounted(true);
    setVisible(true);
  }, []);
  const close = useCallback(() => setVisible(false), []);

  return (
    <Ctx.Provider value={{ open, close, visible }}>
      {children}
      {mounted && (
        <SideDrawer
          visible={visible}
          onFullyClosed={() => setMounted(false)}
          onClose={close}
        />
      )}
    </Ctx.Provider>
  );
}

function SideDrawer({ visible, onClose, onFullyClosed }: { visible: boolean; onClose: () => void; onFullyClosed: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useApp();

  const tx = useSharedValue(-DRAWER_WIDTH);
  const scrimOpacity = useSharedValue(0);

  React.useEffect(() => {
    if (visible) {
      tx.value = withSpring(0, { damping: 22, stiffness: 200 });
      scrimOpacity.value = withTiming(1, { duration: 220 });
    } else {
      scrimOpacity.value = withTiming(0, { duration: 200 });
      tx.value = withTiming(-DRAWER_WIDTH, { duration: 240, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(onFullyClosed)();
      });
    }
  }, [visible, tx, scrimOpacity, onFullyClosed]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimOpacity.value }));
  const drawerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  const go = (path: string) => {
    onClose();
    setTimeout(() => router.push(path as any), 200);
  };

  const menu = [
    { icon: "leaf-outline" as const, label: "Home", to: "/(tabs)" },
    { icon: "grid-outline" as const, label: "Shop all products", to: "/(tabs)/shop" },
    { icon: "gift-outline" as const, label: "Subscribe & Save", to: "/subscribe", accent: true },
    { icon: "basket-outline" as const, label: "My Basket", to: "/(tabs)/cart" },
    { icon: "receipt-outline" as const, label: "My Orders", to: "/orders" },
    { icon: "person-circle-outline" as const, label: "Profile", to: "/(tabs)/profile" },
    ...(user?.role === "admin" ? [{ icon: "shield-checkmark-outline" as const, label: "Admin Panel", to: "/admin" }] : []),
  ];

  return (
    <Modal transparent visible={true} statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        {/* Scrim */}
        <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]}>
          <Pressable style={styles.scrim} onPress={onClose} testID="drawer-scrim" />
        </Animated.View>

        {/* Drawer */}
        <Animated.View style={[styles.drawer, drawerStyle]}>
          {Platform.OS === "ios" ? (
            <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFillObject} />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(253,251,247,0.94)" }]} />
          )}
          <LinearGradient
            colors={["rgba(232,243,230,0.55)", "rgba(253,251,247,0.35)"]}
            style={StyleSheet.absoluteFillObject}
          />

          <View style={{ flex: 1, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 12 }}>
            {/* Brand + user */}
            <View style={styles.brandRow}>
              <View style={styles.leaf}><Ionicons name="leaf" size={20} color={theme.colors.brand} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.brand}>FreshCuts</Text>
                <Text style={styles.brandSub}>Farm to your door</Text>
              </View>
              <Pressable testID="drawer-close" onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={theme.colors.onSurface} />
              </Pressable>
            </View>

            {user ? (
              <View style={styles.userCard}>
                <View style={styles.avatar}><Text style={styles.avatarTxt}>{user.name.charAt(0).toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                </View>
              </View>
            ) : (
              <Pressable testID="drawer-signin" onPress={() => go("/auth")} style={styles.signInCard}>
                <Ionicons name="log-in-outline" size={20} color={theme.colors.brand} />
                <Text style={styles.signInTxt}>Sign in or Create account</Text>
              </Pressable>
            )}

            {/* Menu */}
            <View style={{ marginTop: 12 }}>
              {menu.map((m) => (
                <Pressable
                  key={m.label}
                  testID={`drawer-menu-${m.label.toLowerCase().replace(/\s+/g, "-")}`}
                  onPress={() => go(m.to)}
                  style={[styles.menuRow, m.accent && styles.menuRowAccent]}
                >
                  <Ionicons name={m.icon} size={20} color={m.accent ? theme.colors.accent : theme.colors.onSurface} />
                  <Text style={[styles.menuTxt, m.accent && { color: theme.colors.accent, fontWeight: "700" }]}>{m.label}</Text>
                  {m.accent && <View style={styles.newBadge}><Text style={styles.newBadgeTxt}>NEW</Text></View>}
                </Pressable>
              ))}
            </View>

            <View style={styles.divider} />

            <Text style={styles.section}>Shop by category</Text>
            <View style={{ paddingHorizontal: theme.spacing.md, gap: 8 }}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c.id}
                  testID={`drawer-cat-${c.id}`}
                  onPress={() => {
                    onClose();
                    setTimeout(() => router.push({ pathname: "/(tabs)/shop", params: { category: c.id } }), 200);
                  }}
                  style={styles.catRow}
                >
                  <Image source={{ uri: c.image }} style={styles.catImg} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.catLbl}>{c.label}</Text>
                    <Text style={styles.catMeta}>Explore →</Text>
                  </View>
                </Pressable>
              ))}
            </View>

            <View style={{ flex: 1 }} />

            {user && (
              <Pressable
                testID="drawer-signout"
                onPress={async () => { onClose(); await logout(); router.replace("/(tabs)"); }}
                style={styles.signoutBtn}
              >
                <Ionicons name="log-out-outline" size={18} color={theme.colors.error} />
                <Text style={styles.signoutTxt}>Sign out</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(43,58,44,0.35)" },
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    overflow: "hidden",
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    ...theme.shadow.lg,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: theme.spacing.lg, marginBottom: 16 },
  leaf: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.brandTint, alignItems: "center", justifyContent: "center" },
  brand: { fontSize: 20, fontWeight: "700", color: theme.colors.onSurface },
  brandSub: { fontSize: 11, color: theme.colors.onSurfaceMuted },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.7)", alignItems: "center", justifyContent: "center" },
  userCard: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: theme.spacing.lg, backgroundColor: "rgba(255,255,255,0.6)", padding: 12, borderRadius: theme.radius.lg },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontWeight: "700" },
  userName: { fontSize: 14, fontWeight: "700", color: theme.colors.onSurface },
  userEmail: { fontSize: 11, color: theme.colors.onSurfaceMuted },
  signInCard: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: theme.spacing.lg, backgroundColor: theme.colors.brandTint, padding: 14, borderRadius: theme.radius.lg },
  signInTxt: { color: theme.colors.brand, fontWeight: "700" },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: theme.spacing.lg, paddingVertical: 12 },
  menuRowAccent: { backgroundColor: "rgba(217,93,57,0.08)", marginHorizontal: theme.spacing.md, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md },
  menuTxt: { flex: 1, fontSize: 15, color: theme.colors.onSurface, fontWeight: "500" },
  newBadge: { backgroundColor: theme.colors.accent, paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radius.sm },
  newBadgeTxt: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 10, marginHorizontal: theme.spacing.lg },
  section: { fontSize: 11, fontWeight: "700", color: theme.colors.onSurfaceMuted, paddingHorizontal: theme.spacing.lg, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.6 },
  catRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 8, backgroundColor: "rgba(255,255,255,0.5)", borderRadius: theme.radius.md },
  catImg: { width: 44, height: 44, borderRadius: theme.radius.sm },
  catLbl: { fontSize: 13, fontWeight: "600", color: theme.colors.onSurface },
  catMeta: { fontSize: 11, color: theme.colors.brand, marginTop: 2 },
  signoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: theme.spacing.lg, marginTop: 12, padding: 12, borderRadius: theme.radius.md, backgroundColor: "rgba(208,66,27,0.08)" },
  signoutTxt: { color: theme.colors.error, fontWeight: "700" },
});
