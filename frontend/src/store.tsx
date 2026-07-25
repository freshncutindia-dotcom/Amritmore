import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch, loadToken, setToken } from "./api";

export type User = { email: string; name: string; role: string };
export type CartItem = {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  cut_type: string;
  unit: string;
  image: string;
};

type Ctx = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;

  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (product_id: string, cut_type: string, unit: string) => void;
  updateQty: (product_id: string, cut_type: string, unit: string, qty: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
};

const AppCtx = createContext<Ctx>({} as Ctx);
export const useApp = () => useContext(AppCtx);

const CART_KEY = "freshcuts_cart";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const t = await loadToken();
        if (t) {
          try {
            const me = await apiFetch("/auth/me");
            setUser(me);
          } catch {
            await setToken(null);
          }
        }
        const raw = await AsyncStorage.getItem(CART_KEY);
        if (raw) setCart(JSON.parse(raw));
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    await setToken(res.access_token);
    setUser({ email: res.email, name: res.name, role: res.role });
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await apiFetch("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
    await setToken(res.access_token);
    setUser({ email: res.email, name: res.name, role: res.role });
  }, []);

  const logout = useCallback(async () => {
    await setToken(null);
    setUser(null);
  }, []);

  const addToCart = useCallback((item: CartItem) => {
    setCart((prev) => {
      const idx = prev.findIndex(
        (i) => i.product_id === item.product_id && i.cut_type === item.cut_type && i.unit === item.unit,
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + item.quantity };
        return next;
      }
      return [...prev, item];
    });
  }, []);

  const removeFromCart = useCallback((product_id: string, cut_type: string, unit: string) => {
    setCart((prev) => prev.filter((i) => !(i.product_id === product_id && i.cut_type === cut_type && i.unit === unit)));
  }, []);

  const updateQty = useCallback((product_id: string, cut_type: string, unit: string, qty: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product_id === product_id && i.cut_type === cut_type && i.unit === unit ? { ...i, quantity: qty } : i,
        )
        .filter((i) => i.quantity > 0),
    );
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.quantity * i.price, 0);

  return (
    <AppCtx.Provider
      value={{ user, ready, login, register, logout, cart, addToCart, removeFromCart, updateQty, clearCart, cartCount, cartTotal }}
    >
      {children}
    </AppCtx.Provider>
  );
}
