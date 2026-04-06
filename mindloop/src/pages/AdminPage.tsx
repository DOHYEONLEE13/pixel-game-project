import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuthContext } from "@/contexts/AuthContext";
import { useToast } from "@/components/Toast";
import type { Game } from "@/types/database";

const HERO_VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260325_120549_0cd82c36-56b3-4dd9-b190-069cfc3a623f.mp4";

const categoryLabel: Record<string, string> = {
  action: "액션", puzzle: "퍼즐", rpg: "RPG",
  simulation: "시뮬레이션", strategy: "전략", casual: "캐주얼",
};

interface Stats {
  total: number;
  totalViews: number;
  shortform: number;
  longform: number;
}

export default function AdminPage() {
  const { isAdmin } = useAuthContext();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, totalViews: 0, shortform: 0, longform: 0 });
  const [loading, setLoading] = useState(true);

  const getAdminToken = () => localStorage.getItem("playwave_admin_token") || "";

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_games", {
      admin_token: getAdminToken(),
    });

    if (error) {
      toast("게임 목록 로딩 실패", "error");
      setLoading(false);
      return;
    }

    const all = (data || []) as Game[];
    setGames(all);
    setStats({
      total: all.length,
      totalViews: all.reduce((sum, g) => sum + g.views, 0),
      shortform: all.filter((g) => g.type === "shortform").length,
      longform: all.filter((g) => g.type === "longform").length,
    });
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    if (!isAdmin) {
      navigate("/");
      return;
    }
    fetchData();
  }, [isAdmin, navigate, fetchData]);

  const toggleStatus = async (game: Game) => {
    const newStatus = game.status === "live" ? "draft" : "live";
    const { error } = await supabase.rpc("admin_update_game_status", {
      admin_token: getAdminToken(),
      target_game_id: game.id,
      new_status: newStatus,
    });
    if (error) {
      toast("상태 변경 실패: " + error.message, "error");
      return;
    }
    toast(newStatus === "live" ? `${game.title} 게시됨` : `${game.title} 숨김 처리`, "success");
    fetchData();
  };

  const deleteGame = async (game: Game) => {
    if (!confirm(`"${game.title}" 을(를) 정말 삭제하시겠습니까?`)) return;

    // Delete storage files
    if (game.file_paths && game.file_paths.length > 0) {
      await supabase.storage.from("games").remove(game.file_paths);
    }

    // Delete DB record via admin RPC
    const { error } = await supabase.rpc("admin_delete_game", {
      admin_token: getAdminToken(),
      target_game_id: game.id,
    });
    if (error) {
      toast("삭제 실패: " + error.message, "error");
      return;
    }
    toast("삭제 완료", "success");
    fetchData();
  };

  if (!isAdmin) return null;

  const statCards = [
    { label: "등록 게임", value: stats.total, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" /></svg>, color: "text-blue-400" },
    { label: "총 조회수", value: stats.totalViews.toLocaleString(), icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>, color: "text-green-400" },
    { label: "숏폼", value: stats.shortform, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="7" y="2" width="10" height="20" rx="2" /></svg>, color: "text-purple-400" },
    { label: "롱폼", value: stats.longform, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>, color: "text-orange-400" },
  ];

  return (
    <section className="relative min-h-screen overflow-hidden">
      <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0"><source src={HERO_VIDEO_URL} type="video/mp4" /></video>
      <div className="absolute inset-0 bg-background/75 z-[1]" />

      <div className="relative z-10 pt-24 pb-16 px-4 md:px-16 lg:px-28">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold">관리자 대시보드</h1>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/20 text-accent">ADMIN</span>
          </div>
          <p className="text-muted-foreground text-sm">게임을 관리하고 통계를 확인하세요</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {statCards.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl bg-white/5 backdrop-blur-md border border-white/10 p-4"
            >
              <div className={`mb-3 ${s.color}`}>{s.icon}</div>
              <p className="text-2xl font-bold text-foreground">{loading ? "—" : s.value}</p>
              <p className="text-muted-foreground text-xs mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Games table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl bg-white/5 backdrop-blur-md border border-white/10 overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="text-foreground font-semibold">게임 목록</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-6 h-6 border-2 border-muted-foreground/30 border-t-foreground rounded-full" />
            </div>
          ) : games.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              등록된 게임이 없습니다
            </div>
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
                  {games.map((game, i) => (
                    <motion.tr
                      key={game.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {game.thumbnail_url && (
                            <img src={game.thumbnail_url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                          )}
                          <span className="text-foreground font-medium truncate max-w-[200px]">{game.title}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 hidden sm:table-cell">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground">
                          {game.type === "shortform" ? "SHORT" : "LONG"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground hidden md:table-cell">
                        {categoryLabel[game.category] || game.category}
                      </td>
                      <td className="px-3 py-3 text-right text-muted-foreground hidden sm:table-cell">
                        {game.views.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          game.status === "live"
                            ? "bg-green-500/15 text-green-400"
                            : "bg-yellow-500/15 text-yellow-400"
                        }`}>
                          {game.status === "live" ? "게시중" : "숨김"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => toggleStatus(game)}
                            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                              game.status === "live"
                                ? "bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
                                : "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                            }`}
                          >
                            {game.status === "live" ? "숨김" : "게시"}
                          </button>
                          <button
                            onClick={() => deleteGame(game)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </motion.tr>
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
