"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiFetch, getToken, setToken, clearToken } from "../api/client";

export type WorkStyle = "freelance" | "ses_employee" | "considering";

export interface User {
  id: string;
  email: string;
  name: string;
  workStyle: WorkStyle;
  role: "member" | "admin";
  interests: string[];
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  workStyle: WorkStyle;
  interests: string[];
  clubSlug?: string;
  eventId?: string;
  referrerId?: string;
}

interface AuthResponse {
  token: string;
  user: User;
  joinedClub?: string | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<AuthResponse>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const res = await apiFetch<{ user: User }>("/mypage");
    setUser(res.user);
  }

  useEffect(() => {
    const session = getToken()
      ? apiFetch<{ user: User }>("/mypage").then((res) => setUser(res.user))
      : Promise.reject(new Error("no token"));
    session.catch(() => clearToken()).finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await apiFetch<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(res.token);
    setUser(res.user);
    return res.user;
  }

  async function register(input: RegisterInput) {
    const res = await apiFetch<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
    setToken(res.token);
    setUser(res.user);
    return res;
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
