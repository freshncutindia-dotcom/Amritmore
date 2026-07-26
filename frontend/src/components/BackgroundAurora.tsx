import React from "react";
import { StyleSheet, View, Image as RNImage, useWindowDimensions } from "react-native";

/**
 * App-wide background — user's uploaded pepper/basil hero image.
 * Fitted to the actual viewport (not the intrinsic image size) so the whole
 * composition is centered and visible regardless of screen.
 * Pointer-events disabled so it never blocks touches.
 */
const BG_IMG = require("../../assets/images/bg-hero.webp");

export default function BackgroundAurora() {
  const { width, height } = useWindowDimensions();
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { width, height, overflow: "hidden" },
      ]}
    >
      {/* Soft light base behind the image (visible in letterbox areas) */}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: "#F2F8FE" }]}
      />

      {/* Hero image — constrained to viewport, whole image centered */}
      <RNImage
        source={BG_IMG}
        style={{ position: "absolute", top: 0, left: 0, width, height }}
        resizeMode="contain"
      />

      {/* Gentle white veil so on-screen content stays legible */}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.22)" }]}
      />
    </View>
  );
}
