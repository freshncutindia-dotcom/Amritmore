import React, { useEffect } from "react";
import { StyleSheet, View, Dimensions, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from "react-native-reanimated";

/**
 * A soft "cool light" animated aurora background.
 * Two overlapping blurred blobs slowly drift + scale to give a calming,
 * living-light feeling without impacting performance.
 * Renders behind app content — pointerEvents="none" so it never blocks touches.
 */
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

export default function BackgroundAurora() {
  const t1 = useSharedValue(0);
  const t2 = useSharedValue(0);
  const t3 = useSharedValue(0);

  useEffect(() => {
    t1.value = withRepeat(withTiming(1, { duration: 14000, easing: Easing.inOut(Easing.sin) }), -1, true);
    t2.value = withRepeat(withTiming(1, { duration: 18000, easing: Easing.inOut(Easing.sin) }), -1, true);
    t3.value = withRepeat(withTiming(1, { duration: 22000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [t1, t2, t3]);

  const blob1 = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t1.value, [0, 1], [-80, 80]) },
      { translateY: interpolate(t1.value, [0, 1], [-60, 60]) },
      { scale: interpolate(t1.value, [0, 1], [1, 1.25]) },
    ],
    opacity: interpolate(t1.value, [0, 0.5, 1], [0.85, 1, 0.85]),
  }));

  const blob2 = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t2.value, [0, 1], [60, -60]) },
      { translateY: interpolate(t2.value, [0, 1], [100, -30]) },
      { scale: interpolate(t2.value, [0, 1], [1.2, 0.9]) },
    ],
    opacity: interpolate(t2.value, [0, 0.5, 1], [0.8, 1, 0.8]),
  }));

  const blob3 = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t3.value, [0, 1], [-40, 70]) },
      { translateY: interpolate(t3.value, [0, 1], [40, -80]) },
      { scale: interpolate(t3.value, [0, 1], [0.9, 1.3]) },
    ],
    opacity: interpolate(t3.value, [0, 0.5, 1], [0.7, 0.95, 0.7]),
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Base very-light sky wash */}
      <LinearGradient
        colors={["#DCEBFB", "#EAF4FE", "#D8ECFC"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      {/* Aurora blobs */}
      <Animated.View style={[styles.blob, styles.blobA, blob1]}>
        <LinearGradient
          colors={["rgba(90,170,235,0.85)", "rgba(90,170,235,0)"]}
          style={styles.blobFill}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      <Animated.View style={[styles.blob, styles.blobB, blob2]}>
        <LinearGradient
          colors={["rgba(150,205,245,0.9)", "rgba(150,205,245,0)"]}
          style={styles.blobFill}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      <Animated.View style={[styles.blob, styles.blobC, blob3]}>
        <LinearGradient
          colors={["rgba(200,230,255,0.85)", "rgba(200,230,255,0)"]}
          style={styles.blobFill}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* Soft white veil to keep content readable but let aurora bleed through */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.35)" }]} />
    </View>
  );
}

const BLOB = Math.max(SCREEN_W, SCREEN_H) * 0.9;
const styles = StyleSheet.create({
  blob: {
    position: "absolute",
    width: BLOB,
    height: BLOB,
    borderRadius: BLOB / 2,
    overflow: "hidden",
    // Web-only soft blur for extra dreaminess (native falls back gracefully)
    ...(Platform.OS === "web" ? ({ filter: "blur(60px)" } as any) : {}),
  },
  blobFill: { flex: 1, borderRadius: BLOB / 2 },
  blobA: { top: -BLOB * 0.35, left: -BLOB * 0.25 },
  blobB: { top: SCREEN_H * 0.25, right: -BLOB * 0.35 },
  blobC: { bottom: -BLOB * 0.4, left: SCREEN_W * 0.1 },
});
