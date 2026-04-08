import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthContext } from "@/contexts/AuthContext";
import { getSessionToken } from "@/hooks/useAuth";

const actionTimestamps = new Map<string, number>();
const DEBOUNCE_MS = 1000;

function isDebounced(key: string): boolean {
  const last = actionTimestamps.get(key);
  if (last && Date.now() - last < DEBOUNCE_MS) return true;
  actionTimestamps.set(key, Date.now());
  return false;
}

export function useGameInteractions(gameId: string | null) {
  const { user } = useAuthContext();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const viewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check liked/saved state
  useEffect(() => {
    if (!user || !gameId) {
      setLiked(false);
      setSaved(false);
      return;
    }
    const check = async () => {
      const [likeRes, saveRes] = await Promise.all([
        supabase
          .from("user_likes")
          .select("user_id")
          .eq("user_id", user.id)
          .eq("game_id", gameId)
          .maybeSingle(),
        supabase
          .from("user_saves")
          .select("user_id")
          .eq("user_id", user.id)
          .eq("game_id", gameId)
          .maybeSingle(),
      ]);
      setLiked(!!likeRes.data);
      setSaved(!!saveRes.data);
    };
    check();
  }, [user, gameId]);

  const toggleLike = useCallback(async () => {
    if (!user || !gameId || likeLoading) return false;
    if (isDebounced(`like:${user.id}:${gameId}`)) return false;
    setLikeLoading(true);
    const token = getSessionToken();
    const { data } = await supabase.rpc("toggle_like", { p_token: token, p_game_id: gameId });
    if (typeof data === "boolean") setLiked(data);
    setLikeLoading(false);
    return true;
  }, [user, gameId, likeLoading]);

  const toggleSave = useCallback(async () => {
    if (!user || !gameId || saveLoading) return false;
    if (isDebounced(`save:${user.id}:${gameId}`)) return false;
    setSaveLoading(true);
    const token = getSessionToken();
    const { data } = await supabase.rpc("toggle_save", { p_token: token, p_game_id: gameId });
    if (typeof data === "boolean") setSaved(data);
    setSaveLoading(false);
    return true;
  }, [user, gameId, saveLoading]);

  const incrementViews = useCallback(async () => {
    if (!gameId) return;
    const viewKey = `viewed_${gameId}`;
    if (sessionStorage.getItem(viewKey)) return;
    const viewTimeKey = `viewtime_${gameId}`;
    const lastViewTime = sessionStorage.getItem(viewTimeKey);
    if (lastViewTime && Date.now() - Number(lastViewTime) < 5 * 60 * 1000) return;
    sessionStorage.setItem(viewKey, "1");
    sessionStorage.setItem(viewTimeKey, String(Date.now()));
    await supabase.rpc("increment_views", { game_id_input: gameId });
  }, [gameId]);

  const recordPlay = useCallback(async () => {
    if (!user || !gameId) return;
    const token = getSessionToken();
    await supabase.rpc("record_play", { p_token: token, p_game_id: gameId });
  }, [user, gameId]);

  useEffect(() => {
    return () => {
      if (viewTimerRef.current) clearTimeout(viewTimerRef.current);
    };
  }, []);

  return { liked, saved, toggleLike, toggleSave, incrementViews, recordPlay };
}
