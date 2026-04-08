import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { useToast } from "@/components/Toast";
import AuthModal from "./AuthModal";

interface NavItem {
  label: string;
  to: string;
}

const navLinks: NavItem[] = [
  { label: "Shorts", to: "/shorts" },
  { label: "Games", to: "/games" },
  { label: "Search", to: "/search" },
  { label: "Upload", to: "/upload" },
];

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <circle cx="12" cy="12" r="5.5" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LinkedinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function TwitterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4l7.07 8.58L4 20h2l5.64-5.94L16 20h4l-7.43-8.96L19.71 4H18l-5.29 5.58L8 4H4z" />
    </svg>
  );
}

const socialIcons = [InstagramIcon, LinkedinIcon, TwitterIcon];

export default function Navbar() {
  const location = useLocation();
  const { user, isAdmin, logout, loading } = useAuthContext();
  const { toast } = useToast();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  const displayName = user?.username || "User";
  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <>
      <motion.nav
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" as const }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 md:px-28 py-4"
      >
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-7 h-7 rounded-full border-2 border-foreground/60">
            <div className="w-3 h-3 rounded-full border border-foreground/60" />
          </div>
          <span className="font-bold text-base text-foreground">PLAYWAVE</span>
        </Link>

        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-1 text-sm">
          {navLinks.map((link, i) => {
            const isActive = location.pathname === link.to;
            return (
              <span key={link.label} className="flex items-center gap-1">
                {i > 0 && (
                  <span className="text-muted-foreground mx-1 select-none">
                    &bull;
                  </span>
                )}
                <Link
                  to={link.to}
                  className={`transition-colors duration-200 ${
                    isActive
                      ? "text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              </span>
            );
          })}
        </div>

        {/* Right side: Social + Auth */}
        <div className="flex items-center gap-2">
          {/* Social icons (hide on small screens to save space) */}
          <div className="hidden lg:flex items-center gap-2">
            {socialIcons.map((Icon, i) => (
              <button
                key={i}
                className="liquid-glass w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors duration-200"
              >
                <Icon />
              </button>
            ))}
          </div>

          {/* Auth area */}
          {loading ? (
            <div className="w-10 h-10 rounded-full bg-secondary/50 animate-pulse" />
          ) : user ? (
            /* Avatar dropdown */
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 pl-3 pr-1 py-1 rounded-full hover:bg-white/5 transition-colors"
              >
                <span className="text-sm text-muted-foreground hidden sm:block">
                  {displayName}
                </span>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm ${isAdmin ? "bg-accent text-accent-foreground" : "bg-foreground text-background"}`}>
                  {avatarLetter}
                </div>
              </button>

              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 5, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-56 rounded-xl bg-card/95 backdrop-blur-xl border border-border/40 shadow-2xl overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-border/30">
                    <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                    {isAdmin && (
                      <span className="inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/20 text-accent">
                        ADMIN
                      </span>
                    )}
                  </div>

                  <div className="py-1">
                    <Link
                      to={isAdmin ? "/admin" : "/dashboard"}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="18" height="18" x="3" y="3" rx="2" />
                        <path d="M3 9h18" />
                        <path d="M9 21V9" />
                      </svg>
                      {isAdmin ? "관리자 대시보드" : "내 대시보드"}
                    </Link>
                    <Link
                      to="/my-games"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      내 게임
                    </Link>
                  </div>

                  <div className="border-t border-border/30 py-1">
                    <button
                      onClick={() => {
                        logout();
                        toast("로그아웃 완료", "info");
                        setDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:text-red-400 hover:bg-secondary/50 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      로그아웃
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          ) : (
            /* Login button */
            <button
              onClick={() => setAuthModalOpen(true)}
              className="px-5 py-2 rounded-full bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors"
            >
              로그인
            </button>
          )}
        </div>
      </motion.nav>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </>
  );
}
