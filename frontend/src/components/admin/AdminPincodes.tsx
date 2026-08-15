import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { theme } from "@/src/theme";
import { apiFetch } from "@/src/api";
import { sx } from "./adminStyles";

export default function AdminPincodes() {
  const [pincodes, setPincodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState("");
  const [area, setArea] = useState("");
  const [fee, setFee] = useState("0");

  const load = useCallback(async () => {
    setPincodes(await apiFetch("/pincodes"));
  }, []);

  useEffect(() => { load().catch(() => {}).finally(() => setLoading(false)); }, [load]);

  const addPincode = async () => {
    if (!/^\d{6}$/.test(pin) || !area) return;
    await apiFetch("/pincodes", {
      method: "POST",
      body: JSON.stringify({ pincode: pin, area, delivery_fee: Number(fee), eta_hours: 3 }),
    });
    setPin(""); setArea(""); setFee("0");
    load();
  };

  const delPincode = async (pc: string) => { await apiFetch(`/pincodes/${pc}`, { method: "DELETE" }); load(); };

  if (loading) return <ActivityIndicator color={theme.colors.brand} style={{ marginTop: 40 }} />;

  return (
    <ScrollView contentContainerStyle={sx.scroll}>
      <View style={sx.card}>
        <Text style={sx.formTitle}>Add serviceable pincode</Text>
        <TextInput testID="admin-pin-code" placeholder="6-digit pincode" placeholderTextColor={theme.colors.onSurfaceMuted} keyboardType="number-pad" maxLength={6} style={sx.input} value={pin} onChangeText={setPin} />
        <TextInput testID="admin-pin-area" placeholder="Area name" placeholderTextColor={theme.colors.onSurfaceMuted} style={sx.input} value={area} onChangeText={setArea} />
        <TextInput placeholder="Delivery fee (₹)" placeholderTextColor={theme.colors.onSurfaceMuted} keyboardType="numeric" style={sx.input} value={fee} onChangeText={setFee} />
        <Pressable testID="admin-pin-submit" onPress={addPincode} style={sx.submit}>
          <Text style={sx.submitTxt}>+ Add pincode</Text>
        </Pressable>
      </View>

      {pincodes.map((p, i) => (
        <Animated.View key={p.pincode} entering={FadeInDown.delay(Math.min(i, 20) * 20)} style={sx.item}>
          <View style={{ flex: 1 }}>
            <Text style={sx.itemName}>{p.pincode}</Text>
            <Text style={sx.itemMeta}>{p.area} · ETA {p.eta_hours}h · {p.delivery_fee ? `₹${p.delivery_fee}` : "Free"}</Text>
          </View>
          <Pressable testID={`admin-del-pin-${p.pincode}`} onPress={() => delPincode(p.pincode)} style={sx.delBtn}>
            <Ionicons name="trash" size={16} color={theme.colors.error} />
          </Pressable>
        </Animated.View>
      ))}
    </ScrollView>
  );
}
