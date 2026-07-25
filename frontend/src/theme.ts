export const theme = {
  colors: {
    surface: "#F2F8FE",
    surface2: "#FFFFFF",
    surface3: "#E4EEF7",
    onSurface: "#1F2A3A",
    onSurfaceMuted: "#5A6B7D",
    surfaceInverse: "#1F2A3A",
    onSurfaceInverse: "#F2F8FE",
    brand: "#4FA3E3",
    brandDark: "#2E7DBF",
    onBrand: "#FFFFFF",
    brandTint: "#E6F3FC",
    accent: "#F1A26B",
    onAccent: "#FFFFFF",
    warning: "#E5B472",
    success: "#4FA37B",
    error: "#C86A5B",
    border: "#DCE7F0",
    borderStrong: "#B9CBDA",
    scrim: "rgba(30,50,80,0.42)",
    glass: "rgba(244,250,255,0.72)",
    tabGlass: "rgba(255,255,255,0.62)",
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { sm: 6, md: 12, lg: 20, pill: 999 },
  fonts: { display: "Fraunces_600SemiBold", body: "DMSans_400Regular", bodyBold: "DMSans_500Medium" },
  shadow: {
    sm: { shadowColor: "#1F2A3A", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 2 },
    md: { shadowColor: "#1F2A3A", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 6 },
    lg: { shadowColor: "#1F2A3A", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.18, shadowRadius: 28, elevation: 12 },
  },
};

export const CATEGORIES = [
  { id: "cut-veg", label: "Pre-cut Veggies", emoji: "🔪", icon: "cut-outline", image: require("../assets/images/categories/cut-veg.webp") },
  { id: "cut-fruit", label: "Pre-cut Fruits", emoji: "🍉", icon: "nutrition-outline", image: require("../assets/images/categories/cut-fruit.webp") },
  { id: "whole", label: "Whole Veggies & Fruits", emoji: "🥦", icon: "leaf-outline", image: require("../assets/images/categories/whole.webp") },
  { id: "ready-mix", label: "Ready-to-cook Mixes", emoji: "🍲", icon: "restaurant-outline", image: require("../assets/images/categories/ready-mix.webp") },
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
