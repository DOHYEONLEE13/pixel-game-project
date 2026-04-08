import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface AppUser {
  id: string;
  username: string;
  role: "admin" | "uploader";
}

interface AuthState {
  user: AppUser | null;
  loading: boolean;
}

const SESSION_KEY = "playwave_session";

export function getSessionToken(): string {
  return localStorage.getItem(SESSION_KEY) || "";
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  // Verify session on mount
  useEffect(() => {
    const token = getSessionToken();
    if (!token) {
      setState({ user: null, loading: false });
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc("auth_me", { p_token: token });
      if (error || !data || data.length === 0) {
        localStorage.removeItem(SESSION_KEY);
        setState({ user: null, loading: false });
        return;
      }
      const row = data[0] as AppUser;
      setState({ user: row, loading: false });
    })();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { data, error } = await supabase.rpc("auth_login", {
      p_username: username,
      p_password: password,
    });
    if (error) {
      throw new Error(
        error.message.includes("invalid_credentials")
          ? "아이디 또는 비밀번호가 올바르지 않습니다"
          : error.message
      );
    }
    const token = data as string;
    if (!token) throw new Error("로그인 실패");
    localStorage.setItem(SESSION_KEY, token);

    // Fetch user info
    const me = await supabase.rpc("auth_me", { p_token: token });
    const row = (me.data as AppUser[])?.[0];
    if (!row) throw new Error("사용자 정보를 불러올 수 없습니다");
    setState({ user: row, loading: false });
    return row;
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const { data, error } = await supabase.rpc("auth_register", {
      p_username: username,
      p_password: password,
    });
    if (error) {
      const msg = error.message;
      if (msg.includes("username_taken")) throw new Error("이미 사용 중인 아이디입니다");
      if (msg.includes("username_too_short")) throw new Error("아이디는 3자 이상이어야 합니다");
      if (msg.includes("password_too_short")) throw new Error("비밀번호는 4자 이상이어야 합니다");
      throw new Error(msg);
    }
    const token = data as string;
    localStorage.setItem(SESSION_KEY, token);
    const me = await supabase.rpc("auth_me", { p_token: token });
    const row = (me.data as AppUser[])?.[0];
    if (!row) throw new Error("회원가입 실패");
    setState({ user: row, loading: false });
    return row;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setState({ user: null, loading: false });
  }, []);

  return {
    user: state.user,
    loading: state.loading,
    isAdmin: state.user?.role === "admin",
    login,
    register,
    logout,
  };
}
