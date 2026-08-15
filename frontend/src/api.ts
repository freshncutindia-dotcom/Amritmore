import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
export const API_URL = `${BASE_URL}/api`;

const TOKEN_KEY = "auth_token";
const useSecure = Platform.OS !== "web";

let inMemoryToken: string | null = null;

export async function setToken(token: string | null) {
  inMemoryToken = token;
  if (useSecure) {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } else {
    if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
    else await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

export async function loadToken(): Promise<string | null> {
  if (inMemoryToken) return inMemoryToken;
  let t = useSecure ? await SecureStore.getItemAsync(TOKEN_KEY) : await AsyncStorage.getItem(TOKEN_KEY);
  if (!t && useSecure) {
    // one-time migration from AsyncStorage → SecureStore
    t = await AsyncStorage.getItem(TOKEN_KEY);
    if (t) {
      await SecureStore.setItemAsync(TOKEN_KEY, t);
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
  }
  inMemoryToken = t;
  return t;
}

export async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = await loadToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...opts, headers });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || `Request failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data;
}
