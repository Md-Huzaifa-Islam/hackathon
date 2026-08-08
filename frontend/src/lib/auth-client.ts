import { createAuthClient } from "better-auth/react";
import { API_BASE_URL } from "@/lib/env";

export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  fetchOptions: {
    credentials: "include",
  },
});

export const { useSession, signIn, signUp, signOut } = authClient;
