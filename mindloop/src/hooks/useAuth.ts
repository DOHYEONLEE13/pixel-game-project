import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
}

const ADMIN_TOKEN_KEY = "playwave_admin_token";

/** Check admin token against the server (HMAC verification) */
async function verifyAdminToken(): Promise<boolean> {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token) return false;

  // Quick client-side expiry check to avoid unnecessary RPC calls
  try {
    const payload = token.split(".")[0];
    const expiry = Number(payload.split(":")[1]);
    if (Date.now() / 1000 > expiry) {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      return false;
    }
  } catch {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    return false;
  }

  // Server-side HMAC verification
  const { data, error } = await supabase.rpc("verify_admin_token", {
    token_input: token,
  });
  if (error || !data) {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    return false;
  }
  return true;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    isAdmin: false,
    loading: true,
  });

  // Fetch profile from DB
  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    return data as Profile | null;
  }, []);

  // Listen to auth state changes
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // Check admin token (server-verified)
      const adminValid = await verifyAdminToken();

      // Get initial session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      let profile: Profile | null = null;
      if (session?.user) {
        profile = await fetchProfile(session.user.id);
      }

      if (cancelled) return;
      setState({
        user: session?.user ?? null,
        session,
        profile,
        isAdmin: adminValid,
        loading: false,
      });
    };

    init();

    // Subscribe to changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      let profile: Profile | null = null;
      if (session?.user) {
        profile = await fetchProfile(session.user.id);
      }
      setState((prev) => ({
        ...prev,
        user: session?.user ?? null,
        session,
        profile,
        loading: false,
      }));
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Sign up
  const signUp = useCallback(
    async (email: string, password: string, nickname: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nickname } },
      });
      if (error) throw error;
      return data;
    },
    []
  );

  // Sign in
  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState((prev) => ({
      ...prev,
      user: null,
      session: null,
      profile: null,
    }));
  }, []);

  // Admin login via RPC — returns HMAC-signed token
  const adminLogin = useCallback(async (password: string) => {
    const { data, error } = await supabase.rpc("verify_admin_password", {
      password_input: password,
    });
    if (error) throw error;
    if (!data) throw new Error("비밀번호가 올바르지 않습니다");

    // data is now the HMAC token string (empty string = wrong password)
    const token = data as string;
    if (!token) throw new Error("비밀번호가 올바르지 않습니다");

    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    setState((prev) => ({ ...prev, isAdmin: true }));
  }, []);

  // Admin logout
  const adminLogout = useCallback(() => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setState((prev) => ({ ...prev, isAdmin: false }));
  }, []);

  return {
    ...state,
    signUp,
    signIn,
    signOut,
    adminLogin,
    adminLogout,
  };
}
