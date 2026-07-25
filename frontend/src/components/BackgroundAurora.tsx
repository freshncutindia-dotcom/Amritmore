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
      { translateX: interpolate(t1.value, [0, 1], [-60, 60]) },
      { translateY: interpolate(t1.value, [0, 1], [-40, 40]) },
      { scale: interpolate(t1.value, [0, 1], [1, 1.15]) },
    ],
    opacity: interpolate(t1.value, [0, 0.5, 1], [0.55, 0.75, 0.55]),
  }));

  const blob2 = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t2.value, [0, 1], [40, -40]) },
      { translateY: interpolate(t2.value, [0, 1], [80, -20]) },
      { scale: interpolate(t2.value, [0, 1], [1.1, 0.95]) },
    ],
    opacity: interpolate(t2.value, [0, 0.5, 1], [0.5, 0.7, 0.5]),
  }));

  const blob3 = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t3.value, [0, 1], [-30, 50]) },
      { translateY: interpolate(t3.value, [0, 1], [30, -60]) },
      { scale: interpolate(t3.value, [0, 1], [0.95, 1.2]) },
    ],
    opacity: interpolate(t3.value, [0, 0.5, 1], [0.4, 0.65, 0.4]),
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Base very-light sky wash */}
      <LinearGradient
        colors={["#EAF4FE", "#F6FBFF", "#EEF7FF"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      {/* Aurora blobs */}
      <Animated.View style={[styles.blob, styles.blobA, blob1]}>
        <LinearGradient
          colors={["rgba(120,190,240,0.55)", "rgba(120,190,240,0)"]}
          style={styles.blobFill}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      <Animated.View style={[styles.blob, styles.blobB, blob2]}>
        <LinearGradient
          colors={["rgba(180,220,250,0.55)", "rgba(180,220,250,0)"]}
          style={styles.blobFill}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      <Animated.View style={[styles.blob, styles.blobC, blob3]}>
        <LinearGradient
          colors={["rgba(210,235,255,0.55)", "rgba(210,235,255,0)"]}
          style={styles.blobFill}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* Soft top-to-bottom veil to keep content readable */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.28)" }]} />
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
