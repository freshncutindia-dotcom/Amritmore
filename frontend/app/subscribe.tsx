import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { theme } from "@/src/theme";
import { apiFetch } from "@/src/api";
import { useApp, CartItem } from "@/src/store";

const FREQS = [
  { id: "daily", label: "Daily", desc: "Fresh every morning" },
  { id: "alternate", label: "Alternate days", desc: "Every 2 days" },
  { id: "weekly", label: "Weekly", desc: "Once a week" },
] as const;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const dateAfter = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export default function Subscribe() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cart, user } = useApp();

  const [basket, setBasket] = useState<CartItem[]>(() => cart.map((c) => ({ ...c })));
  const [name, setName] = useState("My veggie basket");
  const [frequency, setFrequency] = useState<"daily" | "alternate" | "weekly">("weekly");
  const [weeklyDay, setWeeklyDay] = useState(5); // Saturday
  const [startOpt, setStartOpt] = useState<1 | 2>(1);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddr, setSelectedAddr] = useState<any | null>(null);
  const [pinInfo, setPinInfo] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState<any | null>(null);

  useEffect(() => {
    if (!user) return;
    apiFetch("/addresses").then((list) => {
      setAddresses(list);
      const def = list.find((a: any) => a.is_default) || list[0];
      if (def) setSelectedAddr(def);
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    const pin = selectedAddr?.pincode;
    if (!pin) { setPinInfo(null); return; }
    apiFetch(`/pincodes/check/${pin}`).then(setPinInfo).catch(() => setPinInfo(null));
  }, [selectedAddr]);

  const updateQty = (item: CartItem, delta: number) => {
    setBasket((prev) => prev
      .map((b) => (b.product_id === item.product_id && b.cut_type === item.cut_type && b.unit === item.unit
        ? { ...b, quantity: Math.max(0, b.quantity + delta) } : b))
      .filter((b) => b.quantity > 0));
  };

  const subtotal = useMemo(() => basket.reduce((s, b) => s + b.price * b.quantity, 0), [basket]);
  const deliveryFee = pinInfo?.serviceable ? pinInfo.delivery_fee ?? 0 : 0;
  const total = subtotal + deliveryFee + 9;

  const submit = async () => {
    if (!user) {
      router.push({ pathname: "/otp", params: { redirect: "/subscribe" } });
      return;
    }
    if (!basket.length) { setErr("Your basket is empty"); return; }
    if (!selectedAddr) { setErr("Select a delivery address"); return; }
    if (!pinInfo?.serviceable) { setErr("Selected address pincode is not serviceable"); return; }
    setBusy(true); setErr("");
    try {
      const addrStr = `${selectedAddr.line1}${selectedAddr.line2 ? ", " + selectedAddr.line2 : ""}, ${selectedAddr.area}`;
      const sub = await apiFetch("/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim() || "My veggie basket",
          items: basket,
          frequency,
          weekly_day: frequency === "weekly" ? weeklyDay : null,
          start_date: dateAfter(startOpt),
          address: addrStr,
          pincode: selectedAddr.pincode,
          phone: selectedAddr.mobile,
        }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(sub);
    } catch (e: any) {
      setErr(e.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setBusy(false);
  };

  const Header = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Ionicons name="chevron-back" size={22} color={theme.colors.onSurface} />
      </Pressable>
      <Text style={styles.htitle}>Subscribe & Save</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (success) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        {Header}
        <View style={styles.successWrap}>
          <Ionicons name="checkmark-circle" size={64} color={theme.colors.success} />
          <Text style={styles.successTitle}>Subscription active! 🎉</Text>
          <Text style={styles.successTxt}>
            First delivery on <Text style={{ fontWeight: "700" }}>{success.next_delivery_date}</Text>.{"\n"}
            Pay cash on each delivery. Pause or skip anytime.
          </Text>
          <Pressable testID="sub-manage-btn" onPress={() => router.replace("/subscriptions")} style={styles.primaryBtn}>
            <Text style={styles.primaryTxt}>Manage my subscriptions</Text>
          </Pressable>
          <Pressable onPress={() => router.replace("/(tabs)")} style={{ padding: 12 }}>
            <Text style={{ color: theme.colors.brandDark, fontWeight: "600" }}>Back to home</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      {Header}
      {basket.length === 0 ? (
        <View style={styles.successWrap}>
          <Text style={{ fontSize: 52 }}>🧺</Text>
          <Text style={styles.successTitle}>Build your basket first</Text>
          <Text style={styles.successTxt}>Add the veggies & fruits you want on repeat to your cart, then come back here to set the schedule.</Text>
          <Pressable testID="sub-shop-btn" onPress={() => router.replace("/(tabs)/shop")} style={styles.primaryBtn}>
            <Text style={styles.primaryTxt}>Browse fresh produce</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
          {/* Basket */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your repeat basket</Text>
            <TextInput
              testID="sub-name"
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholder="Basket name"
              placeholderTextColor={theme.colors.onSurfaceMuted}
              maxLength={60}
            />
            {basket.map((b) => (
              <View key={`${b.product_id}-${b.cut_type}-${b.unit}`} style={styles.itemRow}>
                <Image source={{ uri: b.image }} style={styles.itemImg} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={1}>{b.name}</Text>
                  <Text style={styles.itemMeta}>{b.cut_type} · {b.unit} · ₹{b.price}</Text>
                </View>
                <View style={styles.qtyBox}>
                  <Pressable testID={`sub-dec-${b.product_id}`} onPress={() => updateQty(b, -1)} style={styles.qtyBtn}>
                    <Ionicons name="remove" size={14} color={theme.colors.onSurface} />
                  </Pressable>
                  <Text style={styles.qtyTxt}>{b.quantity}</Text>
                  <Pressable testID={`sub-inc-${b.product_id}`} onPress={() => updateQty(b, 1)} style={styles.qtyBtn}>
                    <Ionicons name="add" size={14} color={theme.colors.onSurface} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>

          {/* Frequency */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>How often?</Text>
            {FREQS.map((f) => (
              <Pressable key={f.id} testID={`freq-${f.id}`} onPress={() => setFrequency(f.id)} style={[styles.freqRow, frequency === f.id && styles.freqActive]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemName, frequency === f.id && { color: theme.colors.brandDark }]}>{f.label}</Text>
                  <Text style={styles.itemMeta}>{f.desc}</Text>
                </View>
                <Ionicons name={frequency === f.id ? "radio-button-on" : "radio-button-off"} size={20} color={frequency === f.id ? theme.colors.brand : theme.colors.onSurfaceMuted} />
              </Pressable>
            ))}
            {frequency === "weekly" && (
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {DAYS.map((d, i) => (
                  <Pressable key={d} testID={`day-${d}`} onPress={() => setWeeklyDay(i)} style={[styles.dayChip, weeklyDay === i && styles.dayChipActive]}>
                    <Text style={[styles.dayTxt, weeklyDay === i && { color: theme.colors.onBrand }]}>{d}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Text style={styles.cardTitle}>Start from</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[1, 2].map((n) => (
                <Pressable key={n} testID={`start-${n}`} onPress={() => setStartOpt(n as 1 | 2)} style={[styles.dayChip, { flex: 1, height: 40 }, startOpt === n && styles.dayChipActive]}>
                  <Text style={[styles.dayTxt, startOpt === n && { color: theme.colors.onBrand }]}>{n === 1 ? "Tomorrow" : "Day after"}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Address */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Deliver to</Text>
            {!user ? (
              <Text style={styles.itemMeta}>Sign in to pick your delivery address.</Text>
            ) : addresses.length === 0 ? (
              <>
                <Text style={styles.itemMeta}>No saved addresses yet.</Text>
                <Pressable testID="sub-add-address" onPress={() => router.push("/addresses")} style={[styles.primaryBtn, { backgroundColor: theme.colors.brandTint }]}>
                  <Text style={[styles.primaryTxt, { color: theme.colors.brandDark }]}>+ Add delivery address</Text>
                </Pressable>
              </>
            ) : (
              addresses.map((a) => {
                const sel = selectedAddr?.id === a.id;
                return (
                  <Pressable key={a.id} testID={`sub-addr-${a.id}`} onPress={() => setSelectedAddr(a)} style={[styles.freqRow, sel && styles.freqActive]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{a.label.toUpperCase()} · {a.name}</Text>
                      <Text style={styles.itemMeta} numberOfLines={1}>{a.line1}, {a.area} · {a.pincode}</Text>
                    </View>
                    <Ionicons name={sel ? "radio-button-on" : "radio-button-off"} size={20} color={sel ? theme.colors.brand : theme.colors.onSurfaceMuted} />
                  </Pressable>
                );
              })
            )}
            {pinInfo && !pinInfo.serviceable && (
              <Text style={styles.err}>⚠️ We don&apos;t deliver to {selectedAddr?.pincode} yet — pick another address.</Text>
            )}
          </View>

          {/* Summary */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Every delivery</Text>
            <View style={styles.sumRow}><Text style={styles.itemMeta}>Basket ({basket.length} items)</Text><Text style={styles.sumVal}>₹{subtotal.toFixed(0)}</Text></View>
            <View style={styles.sumRow}><Text style={styles.itemMeta}>Delivery</Text><Text style={styles.sumVal}>{deliveryFee ? `₹${deliveryFee}` : "Free"}</Text></View>
            <View style={styles.sumRow}><Text style={styles.itemMeta}>Handling</Text><Text style={styles.sumVal}>₹9</Text></View>
            <View style={[styles.sumRow, { marginTop: 4 }]}>
              <Text style={styles.itemName}>Total per delivery</Text>
              <Text style={styles.totalVal}>₹{total.toFixed(0)}</Text>
            </View>
            <View style={styles.codNote}>
              <Ionicons name="cash-outline" size={16} color={theme.colors.brandDark} />
              <Text style={styles.codTxt}>Cash on delivery for each drop. Online payment coming soon.</Text>
            </View>
          </View>

          {!!err && <Text style={[styles.err, { marginBottom: 8 }]}>{err}</Text>}
          <Pressable testID="sub-submit" onPress={submit} disabled={busy} style={[styles.primaryBtn, busy && { opacity: 0.6 }]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryTxt}>Start subscription 🔁</Text>}
          </Pressable>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.spacing.lg, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surface2 },
  htitle: { fontSize: 18, fontWeight: "700", color: theme.colors.onSurface },
  card: { backgroundColor: theme.colors.surface2, borderRadius: theme.radius.lg, padding: theme.spacing.md, gap: 10, marginBottom: theme.spacing.lg, ...theme.shadow.sm },
  cardTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.onSurface },
  input: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, paddingHorizontal: 14, height: 44, color: theme.colors.onSurface, fontSize: 14 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  itemImg: { width: 44, height: 44, borderRadius: theme.radius.md },
  itemName: { fontSize: 14, fontWeight: "700", color: theme.colors.onSurface },
  itemMeta: { fontSize: 12, color: theme.colors.onSurfaceMuted, marginTop: 2, textTransform: "capitalize" },
  qtyBox: { flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.surface3, borderRadius: theme.radius.pill, paddingHorizontal: 6, paddingVertical: 4, gap: 8 },
  qtyBtn: { width: 22, height: 22, borderRadius: 11, backgroundColor: theme.colors.surface2, alignItems: "center", justifyContent: "center" },
  qtyTxt: { minWidth: 14, textAlign: "center", fontWeight: "700", color: theme.colors.onSurface, fontSize: 13 },
  freqRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  freqActive: { borderColor: theme.colors.brand, backgroundColor: theme.colors.brandTint },
  dayChip: { width: 42, height: 36, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surface },
  dayChipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  dayTxt: { fontSize: 12, fontWeight: "700", color: theme.colors.onSurface },
  sumRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sumVal: { fontSize: 13, fontWeight: "600", color: theme.colors.onSurface },
  totalVal: { fontSize: 18, fontWeight: "800", color: theme.colors.brand },
  codNote: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.colors.brandTint, padding: 10, borderRadius: theme.radius.md },
  codTxt: { flex: 1, fontSize: 12, color: theme.colors.brandDark, fontWeight: "600" },
  err: { fontSize: 12, color: theme.colors.error, fontWeight: "600" },
  primaryBtn: { height: 50, borderRadius: theme.radius.pill, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center", marginTop: 4 },
  primaryTxt: { color: theme.colors.onBrand, fontWeight: "700", fontSize: 15 },
  successWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  successTitle: { fontSize: 20, fontWeight: "800", color: theme.colors.onSurface },
  successTxt: { fontSize: 14, color: theme.colors.onSurfaceMuted, textAlign: "center", lineHeight: 21 },
});
