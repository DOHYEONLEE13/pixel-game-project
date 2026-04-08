import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuthContext } from "@/contexts/AuthContext";
import CountUp from "@/components/CountUp";
import { getSessionToken } from "@/hooks/useAuth";
import type { Game } from "@/types/database";

const HERO_VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260325_120549_0cd82c36-56b3-4dd9-b190-069cfc3a623f.mp4";

const categoryLabel: Record<string, string> = {
  action: "액션", puzzle: "퍼즐", rpg: "RPG",
  simulation: "시뮬레이션", strategy: "전략", casual: "캐주얼",
};

interface UploaderStats {
  total_games: number;
  total_views: number;
  total_likes: number;
  pending_count: number;
  live_count: number;
}

export default function DashboardPage() {
  const { user, isAdmin, loading: authLoading } = useAuthContext();
  const navigate = useNavigate();
  const [stats, setStats] = useState<UploaderStats>({
    total_games: 0, total_views: 0, total_likes: 0, pending_count: 0, live_count: 0,
  });
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const token = getSessionToken();
    const [statsRes, gamesRes] = await Promise.all([
      supabase.rpc("uploader_stats", { p_token: token }),
      supabase.rpc("uploader_list_games", { p_token: token }),
    ]);
    if (statsRes.data && statsRes.data[0]) setStats(statsRes.data[0] as UploaderStats);
    if (gamesRes.data) setGames(gamesRes.data as Game[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/"); return; }
    if (isAdmin) { navigate("/admin"); return; }
    load();
  }, [user, isAdmin, authLoading, navigate, load]);

  if (!user || isAdmin) return null;

  // Compute max for graph normalization
  const maxViews = Math.max(1, ...games.map((g) => g.views));

  return (
    <section className="relative min-h-screen overflow-hidden">
      <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0"><source src={HERO_VIDEO_URL} type="video/mp4" /></video>
      <div className="absolute inset-0 bg-background/70 z-[1]" />

      <div className="relative z-10 pt-24 pb-24 md:pb-16 px-4 md:px-16 lg:px-28">
        {/* Greeting */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            안녕하세요, <span className="font-serif italic">{user.username}</span>님 👋
          </h1>
          <p className="text-muted-foreground text-sm">업로드한 게임의 성과를 한눈에 확인하세요</p>
        </motion.div>

        {/* Stat cards with count-up */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" /></svg>
            </div>
            <p className="text-3xl font-bold text-foreground"><CountUp value={stats.total_games} /></p>
            <p className="text-muted-foreground text-xs mt-1">내가 올린 게임</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-5">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            </div>
            <p className="text-3xl font-bold text-foreground"><CountUp value={stats.total_views} /></p>
            <p className="text-muted-foreground text-xs mt-1">총 조회수</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-5">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
            </div>
            <p className="text-3xl font-bold text-foreground"><CountUp value={stats.total_likes} /></p>
            <p className="text-muted-foreground text-xs mt-1">총 좋아요</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-5">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 text-yellow-400 flex items-center justify-center mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            </div>
            <p className="text-3xl font-bold text-foreground"><CountUp value={stats.pending_count} /></p>
            <p className="text-muted-foreground text-xs mt-1">승인 대기 중</p>
          </motion.div>
        </div>

        {/* Per-game performance bars */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="text-foreground font-semibold">게임별 성과</h2>
            <p className="text-muted-foreground text-xs mt-0.5">조회수 기준 랭킹</p>
          </div>
          {loading ? (
            <div className="py-16 flex justify-center">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-6 h-6 border-2 border-muted-foreground/30 border-t-foreground rounded-full" />
            </div>
          ) : games.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              아직 업로드한 게임이 없습니다.{" "}
              <button onClick={() => navigate("/upload")} className="text-foreground underline">지금 업로드하기</button>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {games
                .slice()
                .sort((a, b) => b.views - a.views)
                .map((g, i) => {
                  const pct = (g.views / maxViews) * 100;
                  return (
                    <motion.div
                      key={g.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 + i * 0.04 }}
                      className="flex items-center gap-4"
                    >
                      {g.thumbnail_url ? (
                        <img src={g.thumbnail_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-white/5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-foreground text-sm font-medium truncate">{g.title}</p>
                            <span className="text-[10px] text-muted-foreground flex-shrink-0">{categoryLabel[g.category] || g.category}</span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                              g.status === "live" ? "bg-green-500/15 text-green-400"
                              : g.status === "pending" ? "bg-yellow-500/15 text-yellow-400"
                              : "bg-gray-500/15 text-gray-400"
                            }`}>
                              {g.status === "live" ? "게시중" : g.status === "pending" ? "대기" : "숨김"}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                            <span>👁 {g.views.toLocaleString()}</span>
                            <span>❤ {g.likes.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 1, delay: 0.3 + i * 0.04 }}
                            className="h-full bg-gradient-to-r from-blue-400 to-purple-400 rounded-full"
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
