import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/src/theme";
import { apiFetch } from "@/src/api";
import { useApp } from "@/src/store";

export default function Support() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useApp();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (subject.trim().length < 3 || message.trim().length < 5) {
      setErr("Please add a subject (3+ chars) and a message (5+ chars).");
      return;
    }
    setSending(true); setErr("");
    try {
      await apiFetch("/contact", { method: "POST", body: JSON.stringify({ subject: subject.trim(), message: message.trim() }) });
      setSent(true);
    } catch (e: any) { setErr(e.message); }
    setSending(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.onSurface} />
        </Pressable>
        <Text style={styles.htitle}>Contact Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        {!user ? (
          <View style={styles.card}>
            <Ionicons name="lock-closed-outline" size={32} color={theme.colors.onSurfaceMuted} style={{ alignSelf: "center" }} />
            <Text style={styles.cardTitle}>Sign in to contact us</Text>
            <Text style={styles.muted}>We need your account so we can reply to your query.</Text>
            <Pressable testID="support-signin" onPress={() => router.push("/auth")} style={styles.submit}>
              <Text style={styles.submitTxt}>Sign in</Text>
            </Pressable>
          </View>
        ) : sent ? (
          <View style={styles.card}>
            <Ionicons name="checkmark-circle" size={48} color={theme.colors.success} style={{ alignSelf: "center" }} />
            <Text style={styles.cardTitle}>Message sent! 🎉</Text>
            <Text style={styles.muted}>Our team has received your message and will get back to you soon.</Text>
            <Pressable
              testID="support-another"
              onPress={() => { setSent(false); setSubject(""); setMessage(""); }}
              style={[styles.submit, { backgroundColor: theme.colors.brandTint }]}
            >
              <Text style={[styles.submitTxt, { color: theme.colors.brandDark }]}>Send another message</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>How can we help? 💬</Text>
            <Text style={styles.muted}>Questions about an order, delivery, or products — write to us and we&apos;ll reply to your account.</Text>
            <Text style={styles.label}>Subject</Text>
            <TextInput
              testID="support-subject"
              placeholder="e.g. Issue with my last order"
              placeholderTextColor={theme.colors.onSurfaceMuted}
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              maxLength={120}
            />
            <Text style={styles.label}>Message</Text>
            <TextInput
              testID="support-message"
              placeholder="Tell us what happened…"
              placeholderTextColor={theme.colors.onSurfaceMuted}
              style={[styles.input, styles.textarea]}
              value={message}
              onChangeText={setMessage}
              multiline
              textAlignVertical="top"
              maxLength={2000}
            />
            {!!err && <Text style={styles.err}>{err}</Text>}
            <Pressable testID="support-submit" onPress={submit} disabled={sending} style={[styles.submit, sending && { opacity: 0.6 }]}>
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitTxt}>Send message</Text>}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.spacing.lg, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surface2 },
  htitle: { fontSize: 18, fontWeight: "700", color: theme.colors.onSurface },
  card: { backgroundColor: theme.colors.surface2, borderRadius: theme.radius.lg, padding: theme.spacing.lg, gap: 10, ...theme.shadow.sm },
  cardTitle: { fontSize: 18, fontWeight: "700", color: theme.colors.onSurface, textAlign: "center" },
  muted: { fontSize: 13, color: theme.colors.onSurfaceMuted, textAlign: "center", lineHeight: 19 },
  label: { fontSize: 12, fontWeight: "700", color: theme.colors.onSurfaceMuted, marginTop: 6 },
  input: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, paddingHorizontal: 14, height: 46, color: theme.colors.onSurface, fontSize: 14 },
  textarea: { height: 140, paddingTop: 12 },
  err: { fontSize: 12, color: theme.colors.error, fontWeight: "600" },
  submit: { height: 48, borderRadius: theme.radius.pill, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center", marginTop: 6 },
  submitTxt: { color: theme.colors.onBrand, fontWeight: "700" },
});
