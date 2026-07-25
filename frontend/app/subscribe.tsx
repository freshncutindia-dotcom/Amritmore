import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { theme } from "@/src/theme";
import { apiFetch } from "@/src/api";
import { useApp } from "@/src/store";

type Box = { id: string; name: string; price: number; image: string; tag: string; items: string[] };

const DAYS = ["Monday", "Wednesday", "Friday", "Saturday", "Sunday"];

export default function Subscribe() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useApp();

  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBox, setSelectedBox] = useState<string>("mixed");
  const [frequency, setFrequency] = useState<"weekly" | "biweekly">("weekly");
  const [day, setDay] = useState<string>("Monday");
  const [pincode, setPincode] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const data = await apiFetch("/subscriptions/boxes");
      setBoxes(data);
      setLoading(false);
    })();
  }, []);

  const box = boxes.find((b) => b.id === selectedBox);

  const subscribe = async () => {
    if (!user) {
      router.push("/auth");
      return;
    }
    if (!pincode || !address || !phone) {
      setErr("Please fill in delivery details");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const sub = await apiFetch("/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          box_type: selectedBox,
          frequency,
          delivery_day: day,
          pincode,
          address,
          phone,
        }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubscribed(sub);
    } catch (e: any) {
      setErr(e.message || "Failed to subscribe");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={theme.colors.brand} />
      </View>
    );
  }

  if (subscribed) {
    return (
      <View style={[styles.successWrap, { paddingTop: insets.top + 40 }]}>
        <Animated.View entering={FadeInDown} style={styles.check}>
          <Ionicons name="gift" size={54} color="#fff" />
        </Animated.View>
        <Animated.Text entering={FadeIn.delay(200)} style={styles.successH1}>You're subscribed! 🌱</Animated.Text>
        <Animated.Text entering={FadeIn.delay(300)} style={styles.successSub}>
          Your {subscribed.box_name} will arrive every {subscribed.frequency === "weekly" ? "week" : "2 weeks"} on {subscribed.delivery_day}.
        </Animated.Text>
        <Animated.Text entering={FadeIn.delay(400)} style={styles.successMeta}>
          First delivery on {new Date(subscribed.next_delivery).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
        </Animated.Text>
        <Pressable testID="sub-success-home" style={styles.successBtn} onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.successBtnTxt}>Back to home</Text>
        </Pressable>
      </View>
    );
  }

  const savingsMap: Record<string, string> = { essentials: "₹120", mixed: "₹200", premium: "₹350" };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.back} testID="sub-back">
          <Ionicons name="chevron-back" size={22} color={theme.colors.onSurface} />
        </Pressable>
        <Text style={styles.htitle}>Subscribe & Save</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 160 }} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInUp} style={styles.heroBanner}>
          <LinearGradient colors={[theme.colors.brand, theme.colors.brandDark]} style={StyleSheet.absoluteFillObject} />
          <View style={styles.heroDeco}><Text style={{ fontSize: 60 }}>🥬</Text></View>
          <View style={{ padding: 20, flex: 1 }}>
            <View style={styles.savePill}><Text style={styles.savePillTxt}>Save up to {savingsMap[selectedBox] || "₹350"} per box</Text></View>
            <Text style={styles.heroH1}>Weekly veggie box{"\n"}delivered fresh.</Text>
            <Text style={styles.heroSub}>Skip, pause or cancel anytime.</Text>
          </View>
        </Animated.View>

        <Text style={styles.section}>Pick a box</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, gap: 12 }}>
          {boxes.map((b) => {
            const active = selectedBox === b.id;
            return (
              <Pressable
                key={b.id}
                testID={`box-${b.id}`}
                onPress={() => { Haptics.selectionAsync(); setSelectedBox(b.id); }}
                style={[styles.boxCard, active && styles.boxActive]}
              >
                <Image source={{ uri: b.image }} style={styles.boxImg} contentFit="cover" />
                {active && <View style={styles.tick}><Ionicons name="checkmark" size={14} color="#fff" /></View>}
                <View style={{ padding: 12 }}>
                  <Text style={styles.boxName}>{b.name}</Text>
                  <Text style={styles.boxTag}>{b.tag}</Text>
                  <Text style={styles.boxPrice}>₹{b.price}<Text style={styles.boxPriceUnit}>/box</Text></Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {box && (
          <Animated.View entering={FadeIn} style={styles.itemsBox}>
            <Text style={styles.itemsTitle}>{box.name} includes:</Text>
            {box.items.map((it, i) => (
              <View key={i} style={styles.itemRow}>
                <Ionicons name="checkmark-circle" size={16} color={theme.colors.brand} />
                <Text style={styles.itemTxt}>{it}</Text>
              </View>
            ))}
          </Animated.View>
        )}

        <Text style={styles.section}>Frequency</Text>
        <View style={styles.freqRow}>
          <Pressable testID="freq-weekly" onPress={() => setFrequency("weekly")} style={[styles.freqCard, frequency === "weekly" && styles.freqCardActive]}>
            <Text style={[styles.freqLbl, frequency === "weekly" && styles.freqLblActive]}>Every week</Text>
            <Text style={styles.freqSub}>Most popular</Text>
          </Pressable>
          <Pressable testID="freq-biweekly" onPress={() => setFrequency("biweekly")} style={[styles.freqCard, frequency === "biweekly" && styles.freqCardActive]}>
            <Text style={[styles.freqLbl, frequency === "biweekly" && styles.freqLblActive]}>Every 2 weeks</Text>
            <Text style={styles.freqSub}>Save on shipping</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>Delivery day</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, gap: 8 }}>
          {DAYS.map((d) => {
            const active = day === d;
            return (
              <Pressable key={d} testID={`day-${d.toLowerCase()}`} onPress={() => setDay(d)} style={[styles.dayChip, active && styles.dayChipActive]}>
                <Text style={[styles.dayTxt, active && styles.dayTxtActive]}>{d}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.section}>Delivery details</Text>
        <View style={styles.formBox}>
          <View style={styles.field}>
            <Ionicons name="location-outline" size={18} color={theme.colors.onSurfaceMuted} />
            <TextInput testID="sub-pincode" placeholder="6-digit pincode" placeholderTextColor={theme.colors.onSurfaceMuted} keyboardType="number-pad" maxLength={6} value={pincode} onChangeText={setPincode} style={styles.input} />
          </View>
          <View style={styles.field}>
            <Ionicons name="call-outline" size={18} color={theme.colors.onSurfaceMuted} />
            <TextInput testID="sub-phone" placeholder="Phone number" placeholderTextColor={theme.colors.onSurfaceMuted} keyboardType="phone-pad" value={phone} onChangeText={setPhone} style={styles.input} />
          </View>
          <View style={[styles.field, { alignItems: "flex-start", height: 90 }]}>
            <Ionicons name="home-outline" size={18} color={theme.colors.onSurfaceMuted} style={{ marginTop: 8 }} />
            <TextInput testID="sub-address" placeholder="Full delivery address" placeholderTextColor={theme.colors.onSurfaceMuted} multiline value={address} onChangeText={setAddress} style={[styles.input, { height: 80, textAlignVertical: "top", paddingTop: 8 }]} />
          </View>
        </View>

        {err && <Text style={styles.err}>{err}</Text>}
      </ScrollView>

      <View style={[styles.stickyCta, { paddingBottom: insets.bottom + 12 }]}>
        <View>
          <Text style={styles.stickyLbl}>{frequency === "weekly" ? "Weekly" : "Bi-weekly"}</Text>
          <Text style={styles.stickyPrice}>₹{box?.price || 0}<Text style={styles.stickyUnit}>/box</Text></Text>
        </View>
        <Pressable testID="subscribe-btn" onPress={subscribe} disabled={busy} style={[styles.subBtn, busy && { opacity: 0.6 }]}>
          <Ionicons name="gift" size={18} color={theme.colors.onBrand} />
          <Text style={styles.subBtnTxt}>{busy ? "Subscribing..." : user ? "Start subscription" : "Sign in to subscribe"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.spacing.lg, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surface2 },
  htitle: { fontSize: 18, fontWeight: "700", color: theme.colors.onSurface },

  heroBanner: { flexDirection: "row", height: 180, margin: theme.spacing.lg, borderRadius: theme.radius.lg, overflow: "hidden", ...theme.shadow.md },
  heroDeco: { position: "absolute", right: -10, bottom: -10, opacity: 0.35 },
  savePill: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.25)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill, marginBottom: 12 },
  savePillTxt: { color: "#fff", fontSize: 11, fontWeight: "700" },
  heroH1: { color: "#fff", fontSize: 22, fontWeight: "700", lineHeight: 28 },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 6 },

  section: { fontSize: 12, fontWeight: "700", color: theme.colors.onSurfaceMuted, textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: theme.spacing.lg, marginTop: 20, marginBottom: 10 },

  boxCard: { width: 200, backgroundColor: theme.colors.surface2, borderRadius: theme.radius.lg, overflow: "hidden", borderWidth: 2, borderColor: "transparent", ...theme.shadow.sm },
  boxActive: { borderColor: theme.colors.brand },
  boxImg: { width: "100%", height: 100 },
  tick: { position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center" },
  boxName: { fontSize: 14, fontWeight: "700", color: theme.colors.onSurface },
  boxTag: { fontSize: 11, color: theme.colors.accent, marginTop: 2, fontWeight: "600" },
  boxPrice: { fontSize: 22, fontWeight: "700", color: theme.colors.brand, marginTop: 6 },
  boxPriceUnit: { fontSize: 11, fontWeight: "400", color: theme.colors.onSurfaceMuted },

  itemsBox: { marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.lg, backgroundColor: theme.colors.brandTint, borderRadius: theme.radius.lg, padding: theme.spacing.lg },
  itemsTitle: { fontWeight: "700", color: theme.colors.onSurface, marginBottom: 10 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3 },
  itemTxt: { color: theme.colors.onSurface, fontSize: 13 },

  freqRow: { flexDirection: "row", gap: 10, paddingHorizontal: theme.spacing.lg },
  freqCard: { flex: 1, padding: 16, borderRadius: theme.radius.lg, borderWidth: 1.5, borderColor: theme.colors.border, backgroundColor: theme.colors.surface2 },
  freqCardActive: { borderColor: theme.colors.brand, backgroundColor: theme.colors.brandTint },
  freqLbl: { fontSize: 14, fontWeight: "700", color: theme.colors.onSurface },
  freqLblActive: { color: theme.colors.brand },
  freqSub: { fontSize: 11, color: theme.colors.onSurfaceMuted, marginTop: 2 },

  dayChip: { height: 40, paddingHorizontal: 16, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  dayChipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  dayTxt: { fontSize: 13, color: theme.colors.onSurface },
  dayTxtActive: { color: theme.colors.onBrand, fontWeight: "700" },

  formBox: { paddingHorizontal: theme.spacing.lg, gap: 10 },
  field: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 12, height: 48 },
  input: { flex: 1, color: theme.colors.onSurface, fontSize: 14 },
  err: { color: theme.colors.error, textAlign: "center", marginTop: 12 },

  stickyCta: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.surface2, padding: theme.spacing.lg, flexDirection: "row", alignItems: "center", gap: 12, borderTopLeftRadius: 24, borderTopRightRadius: 24, ...theme.shadow.md },
  stickyLbl: { fontSize: 11, color: theme.colors.onSurfaceMuted },
  stickyPrice: { fontSize: 20, fontWeight: "700", color: theme.colors.onSurface },
  stickyUnit: { fontSize: 12, color: theme.colors.onSurfaceMuted, fontWeight: "400" },
  subBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: theme.colors.brand, height: 52, borderRadius: theme.radius.pill },
  subBtnTxt: { color: theme.colors.onBrand, fontWeight: "700", fontSize: 14 },

  successWrap: { flex: 1, alignItems: "center", padding: theme.spacing.xl, backgroundColor: theme.colors.surface },
  check: { width: 100, height: 100, borderRadius: 50, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center", marginTop: 40, ...theme.shadow.lg },
  successH1: { fontSize: 26, fontWeight: "700", color: theme.colors.onSurface, marginTop: 24, textAlign: "center" },
  successSub: { fontSize: 14, color: theme.colors.onSurfaceMuted, marginTop: 12, textAlign: "center" },
  successMeta: { fontSize: 13, color: theme.colors.brand, fontWeight: "700", marginTop: 20 },
  successBtn: { marginTop: 40, backgroundColor: theme.colors.brand, paddingHorizontal: 32, paddingVertical: 14, borderRadius: theme.radius.pill },
  successBtnTxt: { color: theme.colors.onBrand, fontWeight: "700" },
});
