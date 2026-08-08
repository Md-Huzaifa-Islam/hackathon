"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { readRuntimeConfig } from "@/services/runtime";

type AuthUser = { id: string; name?: string; phone: string } | null;

type OtpPurpose = "login" | "signup" | "payment";

interface AuthContextValue {
  user: AuthUser;
  loading: boolean;
  requestOtp: (phone: string, purpose: OtpPurpose, name?: string) => Promise<void>;
  verifyOtp: (phone: string, code: string, purpose: OtpPurpose) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "cs_user";

function readStoredUser(): AuthUser {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredUser(user: AuthUser) {
  if (!user) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }
}

function getMockOtpCode() {
  return process.env.VITE_MOCK_OTP_CODE ?? "123456";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const runtime = readRuntimeConfig();
  const [user, setUser] = useState<AuthUser>(() => (typeof window === "undefined" ? null : readStoredUser()));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    writeStoredUser(user);
  }, [user]);

  const value = useMemo<AuthContextValue>(() => {
    async function requestOtp(phone: string, purpose: OtpPurpose, name?: string) {
      if (runtime.dataMode === "api") {
        // API mode: forward to backend endpoint (not implemented here).
        await fetch(`${runtime.apiBaseUrl}/api/otp/send`, { method: "POST", body: JSON.stringify({ phone, purpose, name }), headers: { "Content-Type": "application/json" } });
        return;
      }

      // Mock behaviour: store OTP in sessionStorage for verification
      const code = getMockOtpCode();
      sessionStorage.setItem(`cs_pending_otp_${phone}`, JSON.stringify({ code, purpose, expiresAt: Date.now() + 5 * 60 * 1000, name }));
      return;
    }

    async function verifyOtp(phone: string, code: string, purpose: OtpPurpose) {
      if (runtime.dataMode === "api") {
        const res = await fetch(`${runtime.apiBaseUrl}/api/otp/verify`, { method: "POST", body: JSON.stringify({ phone, code, purpose }), headers: { "Content-Type": "application/json" } });
        if (!res.ok) throw new Error("OTP verification failed");
        const data = await res.json();
        const u: AuthUser = { id: data.id, name: data.name, phone: data.phone };
        setUser(u);
        return u;
      }

      const raw = sessionStorage.getItem(`cs_pending_otp_${phone}`);
      if (!raw) throw new Error("No OTP was requested for this number.");
      const pending = JSON.parse(raw) as { code: string; expiresAt: number; name?: string };
      if (Date.now() > pending.expiresAt) {
        sessionStorage.removeItem(`cs_pending_otp_${phone}`);
        throw new Error("OTP expired");
      }

      if (code !== pending.code) {
        throw new Error("Invalid OTP");
      }

      const userObj: AuthUser = { id: `user_${phone}`, name: pending.name ?? "", phone };
      setUser(userObj);
      sessionStorage.removeItem(`cs_pending_otp_${phone}`);
      return userObj;
    }

    function logout() {
      setUser(null);
    }

    return { user, loading, requestOtp, verifyOtp, logout };
  }, [user, loading, runtime]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export type { AuthUser };
