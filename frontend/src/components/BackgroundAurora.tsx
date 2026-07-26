import React from "react";
import { StyleSheet, View, Image as RNImage } from "react-native";

/**
 * App-wide background — user's uploaded pepper/basil hero image.
 * Fitted to screen (contain) and centered so the whole composition is visible.
 * Pointer-events disabled so it never blocks touches.
 */
const BG_IMG = require("../../assets/images/bg-hero.webp");

export default function BackgroundAurora() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Soft light base behind the image (visible in letterbox areas) */}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: "#F2F8FE" }]}
      />

      {/* Hero image — whole image visible, centered, fitted to screen */}
      <RNImage
        source={BG_IMG}
        style={StyleSheet.absoluteFillObject}
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
