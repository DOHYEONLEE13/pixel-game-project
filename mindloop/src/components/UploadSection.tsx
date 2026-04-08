import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuthContext } from "@/contexts/AuthContext";
import { getSessionToken } from "@/hooks/useAuth";
import { useToast } from "@/components/Toast";
import AuthModal from "./AuthModal";

const HERO_VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260325_120549_0cd82c36-56b3-4dd9-b190-069cfc3a623f.mp4";

const ALLOWED_EXTENSIONS = [".html", ".htm", ".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".mp3", ".wav", ".ogg", ".json"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB total

const categoryMap: Record<string, string> = {
  "액션": "action",
  "퍼즐": "puzzle",
  "RPG": "rpg",
  "시뮬레이션": "simulation",
  "전략": "strategy",
  "캐주얼": "casual",
};

const categories = Object.keys(categoryMap);

const gameTypes = [
  { key: "shortform" as const, label: "숏폼", desc: "5분 이하" },
  { key: "longform" as const, label: "롱폼", desc: "5분 이상" },
];

interface UploadForm {
  files: File[];
  thumbnail: File | null;
  thumbnailPreview: string | null;
  title: string;
  category: string;
  type: "shortform" | "longform";
  playtime: string;
  description: string;
  tags: string;
}

/* ── Security Scanner ── */
function scanHtmlFile(content: string): string[] {
  const warnings: string[] = [];
  if (/document\.cookie/i.test(content)) {
    warnings.push("document.cookie 접근이 감지되었습니다");
  }
  if (/\beval\s*\(/.test(content) || /\bnew\s+Function\s*\(/.test(content)) {
    warnings.push("eval() 또는 new Function() 사용이 감지되었습니다");
  }
  // window.location 감지 (단, hash는 허용)
  if (/window\.location(?!\.hash)/i.test(content)) {
    warnings.push("외부 리다이렉트(window.location)가 감지되었습니다");
  }
  // 외부 도메인 fetch/XHR 감지 (CDN 허용 목록 제외)
  const cdnAllowList = ["cdn.jsdelivr.net", "cdnjs.cloudflare.com", "unpkg.com", "fonts.googleapis.com", "fonts.gstatic.com"];
  const urlPattern = /(?:fetch|XMLHttpRequest|\.open)\s*\(\s*['"`](https?:\/\/[^'"`\s]+)/gi;
  let match;
  while ((match = urlPattern.exec(content)) !== null) {
    const url = match[1];
    const isAllowed = cdnAllowList.some((cdn) => url.includes(cdn));
    if (!isAllowed) {
      warnings.push(`외부 네트워크 요청 감지: ${url.slice(0, 60)}`);
      break;
    }
  }
  // localStorage/sessionStorage 접근 감지
  if (/\b(localStorage|sessionStorage)\s*\./.test(content)) {
    warnings.push("localStorage/sessionStorage 접근이 감지되었습니다");
  }
  // parent.postMessage 감지 (iframe 탈출 시도)
  if (/parent\s*\.\s*postMessage|top\s*\.\s*postMessage|window\s*\.\s*parent/i.test(content)) {
    warnings.push("iframe 외부 통신(postMessage) 시도가 감지되었습니다");
  }
  return warnings;
}

function isAllowedFile(name: string): boolean {
  return ALLOWED_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));
}

export default function UploadSection() {
  const { user, isAdmin } = useAuthContext();
  const { toast } = useToast();

  const [form, setForm] = useState<UploadForm>({
    files: [],
    thumbnail: null,
    thumbnailPreview: null,
    title: "",
    category: "",
    type: "shortform",
    playtime: "",
    description: "",
    tags: "",
  });
  const [isDraggingGame, setIsDraggingGame] = useState(false);
  const [isDraggingThumb, setIsDraggingThumb] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [securityWarnings, setSecurityWarnings] = useState<string[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const gameInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const valid = Array.from(newFiles).filter((f) => {
      if (!isAllowedFile(f.name)) {
        toast(`허용되지 않는 파일 형식: ${f.name}`, "error");
        return false;
      }
      if (f.size > MAX_FILE_SIZE) {
        toast(`파일이 너무 큽니다: ${f.name} (개별 최대 10MB)`, "error");
        return false;
      }
      return true;
    });
    if (valid.length === 0) return;

    // Scan HTML files for security issues
    valid.forEach((file) => {
      if (file.name.endsWith(".html") || file.name.endsWith(".htm")) {
        const reader = new FileReader();
        reader.onload = () => {
          const warnings = scanHtmlFile(reader.result as string);
          if (warnings.length > 0) {
            setSecurityWarnings((prev) => [...prev, ...warnings]);
            warnings.forEach((w) => toast(`보안 경고: ${w}`, "warning"));
          }
        };
        reader.readAsText(file);
      }
    });

    setForm((prev) => {
      const merged = [...prev.files, ...valid.filter((f) => !prev.files.some((ef) => ef.name === f.name))];
      const totalSize = merged.reduce((sum, f) => sum + f.size, 0);
      if (totalSize > MAX_TOTAL_SIZE) {
        toast("전체 파일 크기가 50MB를 초과합니다", "error");
        return prev;
      }
      return { ...prev, files: merged };
    });
  }, [toast]);

  const removeFile = (name: string) => {
    setForm((prev) => ({ ...prev, files: prev.files.filter((f) => f.name !== name) }));
  };

  const handleGameDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingGame(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleThumbDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingThumb(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setForm((prev) => ({ ...prev, thumbnail: file, thumbnailPreview: url }));
    }
  }, []);

  const handleGameSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  };

  const handleThumbSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setForm((prev) => ({ ...prev, thumbnail: file, thumbnailPreview: url }));
    }
  };

  const hasHtmlFile = form.files.some((f) => f.name.endsWith(".html") || f.name.endsWith(".htm"));
  const isFormReady = hasHtmlFile && form.title.trim() && form.category;

  const handleUpload = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (!isFormReady) return;

    setIsUploading(true);
    setSecurityWarnings([]);

    try {
      // 1. Generate game ID
      const gameId = crypto.randomUUID();
      const filePaths: string[] = [];

      // 2. Upload all files to Supabase Storage
      for (const file of form.files) {
        const storagePath = `${gameId}/${file.name}`;
        const { error } = await supabase.storage
          .from("games")
          .upload(storagePath, file, { contentType: file.type || "application/octet-stream" });
        if (error) throw new Error(`파일 업로드 실패: ${file.name} — ${error.message}`);
        filePaths.push(storagePath);
      }

      // 3. Determine entry file
      const indexFile = form.files.find((f) => f.name === "index.html");
      const firstHtml = form.files.find((f) => f.name.endsWith(".html") || f.name.endsWith(".htm"));
      const entryFile = indexFile?.name || firstHtml?.name || "";

      // 4. Upload thumbnail if provided
      let thumbnailUrl: string | null = null;
      if (form.thumbnail) {
        const thumbExt = form.thumbnail.name.split(".").pop();
        const thumbPath = `${gameId}/thumbnail.${thumbExt}`;
        const { error } = await supabase.storage
          .from("games")
          .upload(thumbPath, form.thumbnail, { contentType: form.thumbnail.type });
        if (error) throw new Error(`썸네일 업로드 실패: ${error.message}`);

        const { data: urlData } = supabase.storage
          .from("games")
          .getPublicUrl(thumbPath);
        thumbnailUrl = urlData.publicUrl;
      }

      // 5. Get HTML URL
      const { data: htmlUrlData } = supabase.storage
        .from("games")
        .getPublicUrl(`${gameId}/${entryFile}`);

      // 6. Parse tags
      const tags = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      // 7. Insert game metadata via uploader RPC (uploader → pending, admin → live)
      const token = getSessionToken();
      const { error: dbError } = await supabase.rpc("uploader_insert_game", {
        p_token: token,
        p_game_id: gameId,
        p_title: form.title.trim(),
        p_description: form.description.trim() || null,
        p_category: categoryMap[form.category] || "casual",
        p_type: form.type,
        p_playtime: form.playtime.trim() || null,
        p_tags: tags.length > 0 ? tags : null,
        p_html_url: htmlUrlData.publicUrl,
        p_thumbnail_url: thumbnailUrl,
        p_file_paths: filePaths,
        p_entry_file: entryFile,
      });

      if (dbError) throw new Error(`게임 등록 실패: ${dbError.message}`);

      // Success
      toast(
        isAdmin
          ? `${form.title} 업로드 완료!`
          : `${form.title} 제출 완료! 관리자 승인 후 게시됩니다.`,
        "success"
      );
      setUploadDone(true);
      setTimeout(() => {
        setUploadDone(false);
        setForm({
          files: [],
          thumbnail: null,
          thumbnailPreview: null,
          title: "",
          category: "",
          type: "shortform",
          playtime: "",
          description: "",
          tags: "",
        });
      }, 3000);
    } catch (err: any) {
      toast(err.message || "업로드 중 오류가 발생했습니다", "error");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <section className="relative min-h-screen overflow-hidden flex items-center justify-center py-24 px-4">
        {/* Background video */}
        <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0">
          <source src={HERO_VIDEO_URL} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-background/65 z-[1]" />

        {/* Content */}
        <div className="relative z-10 w-full max-w-2xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" as const }}
            className="text-center mb-10"
          >
            <h1 className="text-4xl md:text-5xl font-medium tracking-[-1.5px] leading-[1.1] mb-3">
              서랍 속 게임,{" "}
              <span className="font-serif italic font-normal">지금</span> 꺼내세요
            </h1>
            <p className="text-muted-foreground text-base">
              HTML 파일을 끌어다 놓으면 3초 안에 전 세계가 플레이합니다.
            </p>
          </motion.div>

          {/* Login banner */}
          {!user && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm text-center"
            >
              게임 업로드는 로그인 후 이용 가능합니다.{" "}
              <button
                onClick={() => setShowAuthModal(true)}
                className="underline hover:text-yellow-300"
              >
                로그인
              </button>
            </motion.div>
          )}

          {/* Upload Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" as const }}
            className="liquid-glass rounded-3xl p-6 md:p-8"
            style={{ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
          >
            {/* Two-column: Game files + Thumbnail */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Game Files Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDraggingGame(true); }}
                onDragLeave={() => setIsDraggingGame(false)}
                onDrop={handleGameDrop}
                onClick={() => gameInputRef.current?.click()}
                className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer flex flex-col items-center justify-center p-6 min-h-[200px] group
                  ${isDraggingGame
                    ? "border-foreground bg-foreground/5 scale-[1.02]"
                    : form.files.length > 0
                      ? "border-foreground/30 bg-foreground/5"
                      : "border-border/50 hover:border-foreground/40 hover:bg-foreground/[0.02]"
                  }`}
              >
                <input
                  ref={gameInputRef}
                  type="file"
                  accept={ALLOWED_EXTENSIONS.join(",")}
                  multiple
                  onChange={handleGameSelect}
                  className="hidden"
                />

                <AnimatePresence mode="wait">
                  {form.files.length > 0 ? (
                    <motion.div
                      key="files-selected"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="text-center w-full"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="w-14 h-14 rounded-2xl bg-foreground/10 flex items-center justify-center mx-auto mb-3">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-foreground">
                          <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="12" cy="12" r="10" />
                        </svg>
                      </div>
                      <p className="text-foreground text-sm font-medium mb-2">
                        {form.files.length}개 파일
                      </p>
                      <div className="max-h-[80px] overflow-y-auto space-y-1">
                        {form.files.map((f) => (
                          <div key={f.name} className="flex items-center justify-between text-xs px-2 py-1 rounded-lg bg-foreground/5">
                            <span className="text-muted-foreground truncate max-w-[120px]">{f.name}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeFile(f.name); }}
                              className="text-muted-foreground hover:text-red-400 ml-2 flex-shrink-0"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => gameInputRef.current?.click()}
                        className="text-xs text-muted-foreground hover:text-foreground mt-2 underline"
                      >
                        + 파일 추가
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="file-empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-foreground/5 flex items-center justify-center mx-auto mb-3 group-hover:bg-foreground/10 transition-colors">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground group-hover:text-foreground transition-colors">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                          <polyline points="17,8 12,3 7,8" strokeLinecap="round" strokeLinejoin="round" />
                          <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" />
                        </svg>
                      </div>
                      <p className="text-muted-foreground text-sm font-medium">게임 파일</p>
                      <p className="text-muted-foreground/60 text-xs mt-1">
                        HTML, JS, CSS, 이미지 등 드래그 또는 클릭
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Thumbnail Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDraggingThumb(true); }}
                onDragLeave={() => setIsDraggingThumb(false)}
                onDrop={handleThumbDrop}
                onClick={() => thumbInputRef.current?.click()}
                className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer flex flex-col items-center justify-center p-6 min-h-[200px] group overflow-hidden
                  ${isDraggingThumb
                    ? "border-foreground bg-foreground/5 scale-[1.02]"
                    : form.thumbnailPreview
                      ? "border-transparent"
                      : "border-border/50 hover:border-foreground/40 hover:bg-foreground/[0.02]"
                  }`}
              >
                <input ref={thumbInputRef} type="file" accept="image/*" onChange={handleThumbSelect} className="hidden" />
                <AnimatePresence mode="wait">
                  {form.thumbnailPreview ? (
                    <motion.div key="thumb-selected" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="absolute inset-0">
                      <img src={form.thumbnailPreview} alt="썸네일" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <p className="text-white text-sm font-medium">변경하기</p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="thumb-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
                      <div className="w-14 h-14 rounded-2xl bg-foreground/5 flex items-center justify-center mx-auto mb-3 group-hover:bg-foreground/10 transition-colors">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground group-hover:text-foreground transition-colors">
                          <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21,15 16,10 5,21" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <p className="text-muted-foreground text-sm font-medium">썸네일 이미지</p>
                      <p className="text-muted-foreground/60 text-xs mt-1">그리드에 표시될 이미지</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Security warnings */}
            <AnimatePresence>
              {securityWarnings.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20"
                >
                  <p className="text-yellow-400 text-xs font-semibold mb-1">보안 경고</p>
                  {securityWarnings.map((w, i) => (
                    <p key={i} className="text-yellow-400/80 text-xs">• {w}</p>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form Fields */}
            <div className="space-y-4 mb-6">
              {/* Title */}
              <input
                type="text"
                placeholder="게임 제목"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full bg-foreground/5 border border-border/30 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-foreground/40 transition-colors"
              />

              {/* Game Type */}
              <div className="flex gap-2">
                {gameTypes.map((gt) => (
                  <button
                    key={gt.key}
                    onClick={() => setForm((prev) => ({ ...prev, type: gt.key }))}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 border ${
                      form.type === gt.key
                        ? "bg-foreground text-background border-foreground"
                        : "bg-foreground/5 text-muted-foreground border-border/30 hover:border-foreground/30"
                    }`}
                  >
                    {gt.label} <span className="opacity-60">({gt.desc})</span>
                  </button>
                ))}
              </div>

              {/* Category */}
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setForm((prev) => ({ ...prev, category: prev.category === cat ? "" : cat }))}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                      form.category === cat
                        ? "bg-foreground text-background"
                        : "bg-foreground/5 text-muted-foreground border border-border/30 hover:border-foreground/30 hover:text-foreground"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Playtime + Tags row */}
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="플레이타임 (예: 3분)"
                  value={form.playtime}
                  onChange={(e) => setForm((prev) => ({ ...prev, playtime: e.target.value }))}
                  className="bg-foreground/5 border border-border/30 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-foreground/40 transition-colors"
                />
                <input
                  type="text"
                  placeholder="태그 (쉼표 구분)"
                  value={form.tags}
                  onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
                  className="bg-foreground/5 border border-border/30 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-foreground/40 transition-colors"
                />
              </div>

              {/* Description */}
              <textarea
                placeholder="게임에 대한 짧은 설명 (선택사항)"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full bg-foreground/5 border border-border/30 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-foreground/40 transition-colors resize-none"
              />
            </div>

            {/* Upload Button */}
            <motion.button
              whileHover={isFormReady ? { scale: 1.02, boxShadow: "0 0 30px rgba(255,255,255,0.15)" } : {}}
              whileTap={isFormReady ? { scale: 0.98 } : {}}
              onClick={handleUpload}
              disabled={(!isFormReady && !!user) || isUploading}
              className={`w-full py-4 rounded-2xl text-sm font-semibold transition-all duration-300 relative overflow-hidden ${
                !user
                  ? "bg-yellow-500/20 text-yellow-400 cursor-pointer border border-yellow-500/30"
                  : isFormReady
                    ? "bg-foreground text-background cursor-pointer"
                    : "bg-foreground/10 text-muted-foreground cursor-not-allowed"
              }`}
            >
              <AnimatePresence mode="wait">
                {uploadDone ? (
                  <motion.span key="done" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-center justify-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" /></svg>
                    업로드 완료!
                  </motion.span>
                ) : isUploading ? (
                  <motion.span key="uploading" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-center justify-center gap-2">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full" />
                    업로드 중...
                  </motion.span>
                ) : !user ? (
                  <motion.span key="login-required" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    로그인 후 업로드
                  </motion.span>
                ) : (
                  <motion.span key="idle" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    {isAdmin ? "게임 업로드하기" : "게임 제출하기 (승인 대기)"}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            <p className="text-center text-muted-foreground/50 text-xs mt-4">
              개별 10MB · 전체 50MB · HTML 파일 필수
            </p>

            {/* Legal notice */}
            <div className="mt-4 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
              <p className="text-[11px] leading-relaxed text-muted-foreground text-center">
                저작권이 있는 저작물을 무단 도용하여 발생한 모든 책임은 업로더에게 있으며,
                <span className="text-foreground font-medium"> 'gamedrop'</span>은 이에 대해 어떠한 책임도 지지 않습니다.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </>
  );
}
