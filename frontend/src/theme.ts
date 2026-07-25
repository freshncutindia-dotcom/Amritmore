export const theme = {
  colors: {
    surface: "#FDFBF7",
    surface2: "#FFFFFF",
    surface3: "#F4EFE6",
    onSurface: "#2B3A2C",
    onSurfaceMuted: "#4A5A4A",
    surfaceInverse: "#2B3A2C",
    onSurfaceInverse: "#FDFBF7",
    brand: "#3A7D44",
    brandDark: "#2C5D33",
    onBrand: "#FFFFFF",
    brandTint: "#E8F3E6",
    accent: "#D95D39",
    onAccent: "#FFFFFF",
    warning: "#F5A623",
    success: "#3A7D44",
    error: "#D0421B",
    border: "#E3DCCF",
    borderStrong: "#C8BEAB",
    scrim: "rgba(43,58,44,0.55)",
    glass: "rgba(253,251,247,0.75)",
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { sm: 6, md: 12, lg: 20, pill: 999 },
  fonts: { display: "Fraunces_600SemiBold", body: "DMSans_400Regular", bodyBold: "DMSans_500Medium" },
  shadow: {
    sm: { shadowColor: "#2B3A2C", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
    md: { shadowColor: "#2B3A2C", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.14, shadowRadius: 22, elevation: 8 },
    lg: { shadowColor: "#2B3A2C", shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.22, shadowRadius: 32, elevation: 14 },
  },
};

export const CATEGORIES = [
  { id: "cut-veg", label: "Pre-cut Veggies", emoji: "🔪", image: require("../assets/images/categories/cut-veg.webp") },
  { id: "cut-fruit", label: "Pre-cut Fruits", emoji: "🍉", image: require("../assets/images/categories/cut-fruit.webp") },
  { id: "whole", label: "Whole Veggies & Fruits", emoji: "🥦", image: require("../assets/images/categories/whole.webp") },
  { id: "ready-mix", label: "Ready-to-cook Mixes", emoji: "🍲", image: require("../assets/images/categories/ready-mix.webp") },
];

export const CUT_TYPES = [
  { id: "all", label: "All" },
  { id: "whole", label: "Whole" },
  { id: "sliced", label: "Sliced" },
  { id: "diced", label: "Diced" },
  { id: "shredded", label: "Shredded" },
  { id: "batonnet", label: "Batonnet" },
  { id: "cubed", label: "Cubed" },
  { id: "grated", label: "Grated" },
  { id: "julienne", label: "Julienne" },
  { id: "mix", label: "Mix" },
];
