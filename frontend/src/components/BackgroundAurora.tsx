import React from "react";
import { StyleSheet, View, Image as RNImage, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/**
 * App-wide background — user's uploaded pepper/basil hero image.
 * Pointer-events disabled so it never blocks touches.
 */
const BG_IMG = require("../../assets/images/bg-hero.webp");

export default function BackgroundAurora() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Sky-blue base */}
      <LinearGradient
        colors={["#D6E9FB", "#EAF4FE", "#CFE4F7"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Actual hero image */}
      <RNImage
        source={BG_IMG}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />

      {/* Gentle white veil so on-screen content stays legible */}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.32)" }]}
      />
    </View>
  );
}
