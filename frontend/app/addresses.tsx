import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { theme } from "@/src/theme";
import { apiFetch } from "@/src/api";
import { useApp } from "@/src/store";

export type Address = {
  id: string;
  label: "home" | "office" | "other";
  name: string;
  mobile: string;
  line1: string;
  line2?: string;
  area: string;
  pincode: string;
  is_default: boolean;
};

const LABEL_META = {
  home: { icon: "home", txt: "Home" as const },
  office: { icon: "briefcase", txt: "Office" as const },
  other: { icon: "location", txt: "Other" as const },
};

export default function Addresses() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ pick?: string }>();
  const isPick = params.pick === "1";
  const { user } = useApp();

  const [items, setItems] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [busy, setBusy] = useState(false);

  // form state
  const [label, setLabel] = useState<Address["label"]>("home");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [area, setArea] = useState("");
  const [pincode, setPincode] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data: Address[] = await apiFetch("/addresses");
      setItems(data);
      if (data.length === 0) setShowForm(true);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openForm = (a?: Address) => {
    if (a) {
      setEditing(a);
      setLabel(a.label);
      setName(a.name);
      setMobile(a.mobile);
      setLine1(a.line1);
      setLine2(a.line2 || "");
      setArea(a.area);
      setPincode(a.pincode);
      setIsDefault(a.is_default);
    } else {
      setEditing(null);
      setLabel("home");
      setName(user?.name || "");
      setMobile("");
      setLine1("");
      setLine2("");
      setArea("");
      setPincode("");
      setIsDefault(items.length === 0);
    }
    setShowForm(true);
  };

  const save = async () => {
    if (!name || !mobile || !line1 || !area || !/^\d{6}$/.test(pincode)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("Missing info", "Please fill name, mobile, line 1, area and a valid 6-digit pincode.");
      return;
    }
    setBusy(true);
    try {
      const body = { label, name, mobile, line1, line2, area, pincode, is_default: isDefault };
      let saved: any = null;
      if (editing) {
        saved = await apiFetch(`/addresses/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        saved = await apiFetch("/addresses", { method: "POST", body: JSON.stringify(body) });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowForm(false);
      setEditing(null);
      // In pick mode, immediately return the newly saved address to checkout
      if (isPick && saved?.id) {
        router.replace({ pathname: "/checkout", params: { address_id: saved.id } });
        return;
      }
      await load();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not save address");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    await apiFetch(`/addresses/${id}`, { method: "DELETE" });
    Haptics.selectionAsync();
    load();
  };

  const setDefault = async (id: string) => {
    await apiFetch(`/addresses/${id}/default`, { method: "POST" });
    Haptics.selectionAsync();
    load();
  };

  const pick = (a: Address) => {
    // return the chosen address id via query param to the previous screen
    router.replace({ pathname: "/checkout", params: { address_id: a.id } });
  };

  if (!user) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="lock-closed-outline" size={40} color={theme.colors.onSurfaceMuted} />
        <Text style={styles.centeredTxt}>Sign in to save addresses</Text>
        <Pressable onPress={() => router.push("/auth")} style={styles.signBtn}>
          <Text style={styles.signBtnTxt}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.onSurface} />
        </Pressable>
        <Text style={styles.htitle}>{isPick ? "Choose address" : "Saved addresses"}</Text>
        <Pressable onPress={() => openForm()} style={styles.back}>
          <Ionicons name="add" size={22} color={theme.colors.brand} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <ActivityIndicator color={theme.colors.brand} style={{ marginTop: 40 }} />
        ) : (
          <>
            {items.map((a, i) => (
              <Animated.View key={a.id} entering={FadeInDown.delay(i * 30)}>
                <Pressable
                  testID={`addr-card-${a.id}`}
                  onPress={() => (isPick ? pick(a) : openForm(a))}
                  style={styles.card}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.labelPill}>
                      <Ionicons name={LABEL_META[a.label].icon as any} size={12} color={theme.colors.brandDark} />
                      <Text style={styles.labelTxt}>{LABEL_META[a.label].txt}</Text>
                    </View>
                    {a.is_default && (
                      <View style={styles.defaultPill}>
                        <Text style={styles.defaultTxt}>DEFAULT</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.name}>{a.name}</Text>
                  <Text style={styles.addr}>
                    {a.line1}
                    {a.line2 ? `, ${a.line2}` : ""}
                    {"\n"}
                    {a.area} · {a.pincode}
                  </Text>
                  <Text style={styles.mobile}>{a.mobile}</Text>
                  {!isPick && (
                    <View style={styles.cardActions}>
                      {!a.is_default && (
                        <Pressable testID={`addr-default-${a.id}`} onPress={() => setDefault(a.id)} style={styles.actionBtn}>
                          <Ionicons name="star-outline" size={14} color={theme.colors.brandDark} />
                          <Text style={styles.actionTxt}>Set default</Text>
                        </Pressable>
                      )}
                      <Pressable testID={`addr-edit-${a.id}`} onPress={() => openForm(a)} style={styles.actionBtn}>
                        <Ionicons name="pencil-outline" size={14} color={theme.colors.brandDark} />
                        <Text style={styles.actionTxt}>Edit</Text>
                      </Pressable>
                      <Pressable testID={`addr-del-${a.id}`} onPress={() => remove(a.id)} style={styles.actionBtn}>
                        <Ionicons name="trash-outline" size={14} color={theme.colors.error} />
                        <Text style={[styles.actionTxt, { color: theme.colors.error }]}>Delete</Text>
                      </Pressable>
                    </View>
                  )}
                </Pressable>
              </Animated.View>
            ))}

            {showForm && (
              <Animated.View entering={FadeIn} style={styles.form}>
                <Text style={styles.formTitle}>{editing ? "Edit address" : "Add new address"}</Text>

                <View style={styles.labelRow}>
                  {(["home", "office", "other"] as const).map((l) => (
                    <Pressable
                      key={l}
                      testID={`addr-label-${l}`}
                      onPress={() => setLabel(l)}
                      style={[styles.labelChip, label === l && styles.labelChipActive]}
                    >
                      <Ionicons
                        name={LABEL_META[l].icon as any}
                        size={14}
                        color={label === l ? theme.colors.onBrand : theme.colors.onSurface}
                      />
                      <Text style={[styles.labelChipTxt, label === l && { color: theme.colors.onBrand }]}>
                        {LABEL_META[l].txt}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <TextInput testID="addr-name" placeholder="Full name" placeholderTextColor={theme.colors.onSurfaceMuted}
                  value={name} onChangeText={setName} style={styles.input} />
                <TextInput testID="addr-mobile" placeholder="Mobile number" placeholderTextColor={theme.colors.onSurfaceMuted}
                  keyboardType="phone-pad" value={mobile} onChangeText={setMobile} style={styles.input} />
                <TextInput testID="addr-line1" placeholder="House / Flat / Building" placeholderTextColor={theme.colors.onSurfaceMuted}
                  value={line1} onChangeText={setLine1} style={styles.input} />
                <TextInput testID="addr-line2" placeholder="Street / Landmark (optional)" placeholderTextColor={theme.colors.onSurfaceMuted}
                  value={line2} onChangeText={setLine2} style={styles.input} />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput testID="addr-area" placeholder="Area / Locality" placeholderTextColor={theme.colors.onSurfaceMuted}
                    value={area} onChangeText={setArea} style={[styles.input, { flex: 1 }]} />
                  <TextInput testID="addr-pincode" placeholder="Pincode" placeholderTextColor={theme.colors.onSurfaceMuted}
                    keyboardType="number-pad" maxLength={6} value={pincode} onChangeText={setPincode}
                    style={[styles.input, { width: 120 }]} />
                </View>

                <Pressable
                  testID="addr-default-toggle"
                  onPress={() => setIsDefault((v) => !v)}
                  style={styles.defToggle}
                >
                  <Ionicons
                    name={isDefault ? "checkbox" : "square-outline"}
                    size={20}
                    color={isDefault ? theme.colors.brand : theme.colors.onSurfaceMuted}
                  />
                  <Text style={styles.defToggleTxt}>Make this my default address</Text>
                </Pressable>

                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <Pressable
                    onPress={() => { setShowForm(false); setEditing(null); }}
                    style={[styles.saveBtn, styles.cancelBtn]}
                  >
                    <Text style={[styles.saveTxt, { color: theme.colors.onSurface }]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    testID="addr-save"
                    onPress={save}
                    disabled={busy}
                    style={[styles.saveBtn, busy && { opacity: 0.5 }]}
                  >
                    {busy ? <ActivityIndicator color={theme.colors.onBrand} /> : <Text style={styles.saveTxt}>Save address</Text>}
                  </Pressable>
                </View>
              </Animated.View>
            )}

            {!showForm && (
              <Pressable testID="addr-add-btn" onPress={() => openForm()} style={styles.addBtn}>
                <Ionicons name="add-circle" size={22} color={theme.colors.brand} />
                <Text style={styles.addBtnTxt}>Add new address</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 12 },
  centeredTxt: { fontSize: 15, color: theme.colors.onSurface, marginTop: 8 },
  signBtn: { marginTop: 16, backgroundColor: theme.colors.brand, paddingHorizontal: 28, paddingVertical: 12, borderRadius: theme.radius.pill },
  signBtnTxt: { color: theme.colors.onBrand, fontWeight: "700" },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border,
  },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.7)" },
  htitle: { fontSize: 18, fontWeight: "700", color: theme.colors.onSurface },

  card: {
    backgroundColor: theme.colors.surface2,
    borderRadius: theme.radius.lg, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: theme.colors.border,
    ...theme.shadow.sm,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  labelPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: theme.colors.brandTint,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill,
  },
  labelTxt: { fontSize: 11, fontWeight: "700", color: theme.colors.brandDark },
  defaultPill: {
    backgroundColor: theme.colors.brand,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill,
  },
  defaultTxt: { fontSize: 9, fontWeight: "800", color: theme.colors.onBrand, letterSpacing: 0.5 },
  name: { fontSize: 15, fontWeight: "700", color: theme.colors.onSurface },
  addr: { fontSize: 13, color: theme.colors.onSurface, lineHeight: 18, marginTop: 4 },
  mobile: { fontSize: 12, color: theme.colors.onSurfaceMuted, marginTop: 6 },
  cardActions: { flexDirection: "row", gap: 14, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionTxt: { fontSize: 12, fontWeight: "600", color: theme.colors.brandDark },

  form: {
    backgroundColor: theme.colors.surface2,
    borderRadius: theme.radius.lg, padding: 16, gap: 10,
    borderWidth: 1, borderColor: theme.colors.border,
    marginBottom: 12,
  },
  formTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.onSurface, marginBottom: 4 },
  labelRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  labelChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, height: 34, borderRadius: theme.radius.pill,
    borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  labelChipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  labelChipTxt: { fontSize: 12, fontWeight: "600", color: theme.colors.onSurface },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md, paddingHorizontal: 14, height: 46,
    color: theme.colors.onSurface, fontSize: 14,
  },
  defToggle: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  defToggleTxt: { fontSize: 13, color: theme.colors.onSurface },
  saveBtn: {
    flex: 1, height: 48, borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center",
  },
  cancelBtn: { backgroundColor: theme.colors.surface3 },
  saveTxt: { color: theme.colors.onBrand, fontWeight: "700" },

  addBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    padding: 16, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.brand, borderStyle: "dashed",
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  addBtnTxt: { color: theme.colors.brand, fontWeight: "700" },
});
