"use client";

import React, { createContext, useContext, useMemo } from "react";
import { signIn, signOut, signUp, useSession } from "@/lib/auth-client";

type AuthUser = { id: string; name?: string; email: string } | null;

interface AuthContextValue {
  user: AuthUser;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  signup: (name: string, email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(user: { id: string; name?: string | null; email: string } | null | undefined): AuthUser {
  if (!user) return null;
  return { id: user.id, name: user.name ?? undefined, email: user.email };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();

  const value = useMemo<AuthContextValue>(() => {
    async function login(email: string, password: string) {
      const result = await signIn.email({ email, password });
      if (result.error) {
        throw new Error(result.error.message ?? "Invalid email or password.");
      }
      return toAuthUser(result.data?.user);
    }

    async function signup(name: string, email: string, password: string) {
      const result = await signUp.email({ name, email, password });
      if (result.error) {
        throw new Error(result.error.message ?? "Unable to create account.");
      }
      return toAuthUser(result.data?.user);
    }

    async function logout() {
      await signOut();
    }

    return { user: toAuthUser(session?.user), loading: isPending, login, signup, logout };
  }, [session, isPending]);

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
