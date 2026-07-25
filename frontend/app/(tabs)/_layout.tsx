import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useEffect } from "react";
import { useSharedValue } from "react-native-reanimated";

import { theme } from "@/src/theme";
import { useApp } from "@/src/store";

function CartBadge() {
  const { cartCount } = useApp();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (cartCount > 0) {
      scale.value = withSpring(1.4, { damping: 6, stiffness: 200 }, () => {
        scale.value = withSpring(1, { damping: 8, stiffness: 200 });
      });
    }
  }, [cartCount, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  if (cartCount === 0) return null;
  return (
    <Animated.View style={[styles.badge, style]} testID="tab-cart-badge">
      <Text style={styles.badgeText}>{cartCount}</Text>
    </Animated.View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.brand,
        tabBarInactiveTintColor: theme.colors.onSurfaceMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500", marginTop: -2 },
        tabBarStyle: styles.tabBar,
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.surface2 }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="leaf" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: "Shop",
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="basket" size={size} color={color} />
              <CartBadge />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    height: 78,
    paddingTop: 8,
    paddingBottom: 20,
    backgroundColor: Platform.OS === "ios" ? "transparent" : theme.colors.surface2,
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});
