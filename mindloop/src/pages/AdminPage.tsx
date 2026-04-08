import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuthContext } from "@/contexts/AuthContext";
import { useToast } from "@/components/Toast";
import CountUp from "@/components/CountUp";
import { getSessionToken } from "@/hooks/useAuth";
import type { Game } from "@/types/database";

const HERO_VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260325_120549_0cd82c36-56b3-4dd9-b190-069cfc3a623f.mp4";

const categoryLabel: Record<string, string> = {
  action: "액션", puzzle: "퍼즐", rpg: "RPG",
  simulation: "시뮬레이션", strategy: "전략", casual: "캐주얼",
};

interface SystemStats {
  total_users: number;
  total_uploaders: number;
  total_games: number;
  pending_games: number;
  live_games: number;
  total_views: number;
  total_likes: number;
}

// Dummy server/traffic data (백엔드 미연결)
const DUMMY_SERVER = {
  uptime: "99.98%",
  cpu: 42,
  memory: 61,
  requests24h: 18934,
};

function StatCard({ label, value, icon, color, suffix }: { label: string; value: number; icon: React.ReactNode; color: string; suffix?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-5"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
      </div>
      <p className="text-3xl font-bold text-foreground">
        <CountUp value={value} />
        {suffix && <span className="text-base font-medium text-muted-foreground ml-1">{suffix}</span>}
      </p>
      <p className="text-muted-foreground text-xs mt-1">{label}</p>
    </motion.div>
  );
}

export default function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuthContext();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [stats, setStats] = useState<SystemStats>({
    total_users: 0, total_uploaders: 0, total_games: 0,
    pending_games: 0, live_games: 0, total_views: 0, total_likes: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const token = getSessionToken();
    const [gamesRes, statsRes] = await Promise.all([
      supabase.rpc("admin_list_games", { p_token: token }),
      supabase.rpc("admin_system_stats", { p_token: token }),
    ]);
    if (gamesRes.error) {
      toast("게임 목록 로딩 실패", "error");
    } else {
      setGames((gamesRes.data || []) as Game[]);
    }
    if (statsRes.data && statsRes.data[0]) {
      setStats(statsRes.data[0] as SystemStats);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) {
      navigate("/");
      return;
    }
    fetchData();
  }, [user, isAdmin, authLoading, navigate, fetchData]);

  const updateStatus = async (game: Game, newStatus: "live" | "draft" | "pending") => {
    const { error } = await supabase.rpc("admin_update_game_status", {
      p_token: getSessionToken(),
      p_game_id: game.id,
      p_new_status: newStatus,
    });
    if (error) { toast("상태 변경 실패", "error"); return; }
    toast(
      newStatus === "live" ? `${game.title} 승인/게시` : newStatus === "draft" ? `${game.title} 숨김` : `${game.title} 대기`,
      "success"
    );
    fetchData();
  };

  const deleteGame = async (game: Game) => {
    if (!confirm(`"${game.title}" 을(를) 정말 삭제하시겠습니까?`)) return;
    if (game.file_paths && game.file_paths.length > 0) {
      await supabase.storage.from("games").remove(game.file_paths);
    }
    const { error } = await supabase.rpc("admin_delete_game", {
      p_token: getSessionToken(),
      p_game_id: game.id,
    });
    if (error) { toast("삭제 실패", "error"); return; }
    toast("삭제 완료", "success");
    fetchData();
  };

  if (!user || !isAdmin) return null;

  const pendingGames = games.filter((g) => g.status === "pending");

  return (
    <section className="relative min-h-screen overflow-hidden">
      <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0"><source src={HERO_VIDEO_URL} type="video/mp4" /></video>
      <div className="absolute inset-0 bg-background/80 z-[1]" />

      <div className="relative z-10 pt-24 pb-24 md:pb-16 px-4 md:px-16 lg:px-28">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center text-accent">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold">시스템 통합 관리창</h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/20 text-accent">ADMIN</span>
              </div>
              <p className="text-muted-foreground text-sm">전체 사용자, 승인 대기, 트래픽을 한눈에 확인하세요</p>
            </div>
          </div>
        </motion.div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="전체 사용자 수"
            value={stats.total_users}
            color="bg-blue-500/10 text-blue-400"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>}
          />
          <StatCard
            label="등록된 게임"
            value={stats.total_games}
            color="bg-purple-500/10 text-purple-400"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" /></svg>}
          />
          <StatCard
            label="승인 대기"
            value={stats.pending_games}
            color="bg-yellow-500/10 text-yellow-400"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
          />
          <StatCard
            label="총 조회수"
            value={stats.total_views}
            color="bg-green-500/10 text-green-400"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>}
          />
        </div>

        {/* Pending approval queue */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 overflow-hidden mb-8"
        >
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-400">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <h2 className="text-foreground font-semibold">신규 업로드 승인 대기</h2>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400">
              {pendingGames.length}건
            </span>
          </div>
          {loading ? (
            <div className="py-10 flex justify-center">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-6 h-6 border-2 border-muted-foreground/30 border-t-foreground rounded-full" />
            </div>
          ) : pendingGames.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">승인 대기 중인 게임이 없습니다</div>
          ) : (
            <div className="divide-y divide-white/5">
              {pendingGames.map((g) => (
                <div key={g.id} className="flex items-center gap-3 px-5 py-3">
                  {g.thumbnail_url && <img src={g.thumbnail_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground text-sm font-medium truncate">{g.title}</p>
                    <p className="text-muted-foreground text-xs">{categoryLabel[g.category] || g.category} · {g.type === "shortform" ? "SHORT" : "LONG"}</p>
                  </div>
                  <button
                    onClick={() => updateStatus(g, "live")}
                    className="text-xs px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors"
                  >
                    승인
                  </button>
                  <button
                    onClick={() => deleteGame(g)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    거부
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Server status + traffic */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
                <rect x="2" y="2" width="20" height="8" rx="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" />
                <line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
              <h3 className="text-foreground font-semibold text-sm">서버 상태</h3>
              <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">ONLINE</span>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">가동 시간</span>
                  <span className="text-foreground font-medium">{DUMMY_SERVER.uptime}</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">CPU</span>
                  <span className="text-foreground font-medium">{DUMMY_SERVER.cpu}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${DUMMY_SERVER.cpu}%` }} transition={{ duration: 1 }} className="h-full bg-blue-400 rounded-full" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">메모리</span>
                  <span className="text-foreground font-medium">{DUMMY_SERVER.memory}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${DUMMY_SERVER.memory}%` }} transition={{ duration: 1 }} className="h-full bg-purple-400 rounded-full" />
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <h3 className="text-foreground font-semibold text-sm">24시간 트래픽 리포트</h3>
            </div>
            <p className="text-3xl font-bold text-foreground">
              <CountUp value={DUMMY_SERVER.requests24h} />
            </p>
            <p className="text-muted-foreground text-xs mt-1">총 요청 수</p>
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/5">
              <div>
                <p className="text-xs text-muted-foreground">총 좋아요</p>
                <p className="text-lg font-semibold text-foreground"><CountUp value={stats.total_likes} /></p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">업로더 수</p>
                <p className="text-lg font-semibold text-foreground"><CountUp value={stats.total_uploaders} /></p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Full games table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="text-foreground font-semibold">전체 게임 목록</h2>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-6 h-6 border-2 border-muted-foreground/30 border-t-foreground rounded-full" />
            </div>
          ) : games.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">등록된 게임이 없습니다</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-muted-foreground text-xs">
                    <th className="text-left px-5 py-3 font-medium">제목</th>
                    <th className="text-left px-3 py-3 font-medium hidden sm:table-cell">유형</th>
                    <th className="text-left px-3 py-3 font-medium hidden md:table-cell">카테고리</th>
                    <th className="text-right px-3 py-3 font-medium hidden sm:table-cell">조회수</th>
                    <th className="text-center px-3 py-3 font-medium">상태</th>
                    <th className="text-right px-5 py-3 font-medium">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((game) => (
                    <tr key={game.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {game.thumbnail_url && <img src={game.thumbnail_url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />}
                          <span className="text-foreground font-medium truncate max-w-[200px]">{game.title}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 hidden sm:table-cell">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground">
                          {game.type === "shortform" ? "SHORT" : "LONG"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground hidden md:table-cell">{categoryLabel[game.category] || game.category}</td>
                      <td className="px-3 py-3 text-right text-muted-foreground hidden sm:table-cell">{game.views.toLocaleString()}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          game.status === "live" ? "bg-green-500/15 text-green-400"
                          : game.status === "pending" ? "bg-yellow-500/15 text-yellow-400"
                          : "bg-gray-500/15 text-gray-400"
                        }`}>
                          {game.status === "live" ? "게시중" : game.status === "pending" ? "대기" : "숨김"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {game.status !== "live" && (
                            <button onClick={() => updateStatus(game, "live")} className="text-xs px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors">게시</button>
                          )}
                          {game.status === "live" && (
                            <button onClick={() => updateStatus(game, "draft")} className="text-xs px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors">숨김</button>
                          )}
                          <button onClick={() => deleteGame(game)} className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">삭제</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
