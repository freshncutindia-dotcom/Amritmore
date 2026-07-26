import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/**
 * App-wide background. Currently a soft sky-blue gradient — will be replaced
 * with the user-provided image/video once uploaded.
 * pointerEvents="none" everywhere so it never blocks touches.
 */
export default function BackgroundAurora() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={["#D6E9FB", "#EAF4FE", "#CFE4F7"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
