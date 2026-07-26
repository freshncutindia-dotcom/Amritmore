import React from "react";
import { StyleSheet, View, Image as RNImage } from "react-native";

/**
 * App-wide background — user's uploaded pepper/basil hero image.
 * Pointer-events disabled so it never blocks touches.
 */
const BG_IMG = require("../../assets/images/bg-hero.webp");

export default function BackgroundAurora() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Hero image */}
      <RNImage
        source={BG_IMG}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />

      {/* Gentle white veil so content stays legible */}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.22)" }]}
      />
    </View>
  );
}
