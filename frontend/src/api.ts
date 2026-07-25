import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
export const API_URL = `${BASE_URL}/api`;

let inMemoryToken: string | null = null;

export async function setToken(token: string | null) {
  inMemoryToken = token;
  if (token) await AsyncStorage.setItem("auth_token", token);
  else await AsyncStorage.removeItem("auth_token");
}

export async function loadToken(): Promise<string | null> {
  if (inMemoryToken) return inMemoryToken;
  const t = await AsyncStorage.getItem("auth_token");
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
