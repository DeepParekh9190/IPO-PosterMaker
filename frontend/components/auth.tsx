"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, api } from "@/lib/api";
import type { Me } from "@/lib/types";

interface AuthApi {
  me: Me | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<Me | null>;
  login: (email: string, password: string) => Promise<Me>;
  register: (email: string, password: string, businessName: string) => Promise<Me>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<Me | null> => {
    try {
      const data = await api.get<Me>("/api/me");
      setMe(data);
      setError(null);
      return data;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setMe(null);
      else if (err instanceof ApiError) setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    await api.post("/api/auth/login", { email, password });
    const data = await refresh();
    if (!data) throw new ApiError(401, "Login succeeded but the session could not load.");
    return data;
  }, [refresh]);

  const register = useCallback(
    async (email: string, password: string, businessName: string) => {
      await api.post("/api/auth/register", {
        email,
        password,
        business_name: businessName || undefined,
      });
      const data = await refresh();
      if (!data) throw new ApiError(401, "Registration succeeded but the session could not load.");
      return data;
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } finally {
      setMe(null);
    }
  }, []);

  const value = useMemo<AuthApi>(
    () => ({ me, loading, error, refresh, login, register, logout }),
    [me, loading, error, refresh, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
