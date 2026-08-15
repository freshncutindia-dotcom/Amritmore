import { StyleSheet } from "react-native";
import { theme } from "@/src/theme";

export const sx = StyleSheet.create({
  scroll: { padding: theme.spacing.lg, paddingBottom: 120 },
  card: { backgroundColor: theme.colors.surface2, borderRadius: theme.radius.lg, padding: theme.spacing.md, gap: 10, marginBottom: theme.spacing.lg, ...theme.shadow.sm },
  formTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.onSurface, marginBottom: 4 },
  input: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, paddingHorizontal: 14, height: 44, color: theme.colors.onSurface, fontSize: 14 },
  mini: { fontSize: 12, fontWeight: "700", color: theme.colors.onSurfaceMuted, marginTop: 4 },
  chip: { paddingHorizontal: 14, height: 32, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, justifyContent: "center" },
  chipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  chipTxt: { fontSize: 12, color: theme.colors.onSurface },
  chipTxtActive: { color: theme.colors.onBrand, fontWeight: "600" },
  submit: { height: 48, borderRadius: theme.radius.pill, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center", marginTop: 6 },
  submitTxt: { color: theme.colors.onBrand, fontWeight: "700" },
  item: { flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.surface2, borderRadius: theme.radius.md, padding: 12, marginBottom: 8, ...theme.shadow.sm },
  itemName: { fontSize: 14, fontWeight: "700", color: theme.colors.onSurface },
  itemMeta: { fontSize: 12, color: theme.colors.onSurfaceMuted, marginTop: 2 },
  delBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#FDECE7", alignItems: "center", justifyContent: "center" },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.brandTint, alignItems: "center", justifyContent: "center" },
  statusOk: { fontSize: 12, color: theme.colors.success, fontWeight: "600" },
  statusErr: { fontSize: 12, color: theme.colors.error, fontWeight: "600" },
});
