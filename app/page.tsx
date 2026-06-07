"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const links = [
  {
    href: "/pathfinder",
    emoji: "⚔️",
    title: "Pathfinder",
    desc: "Character sheets, spells, inventory & combat tracker",
    hue: 28,
  },
  {
    href: "/pathfinder/index.html",
    emoji: "⚔️",
    title: "Pathfinder Legacy",
    desc: "Original version — pre Feb 2026",
    hue: 40,
    small: true,
  },
  {
    href: "/mtg/index.html",
    emoji: "🃏",
    title: "Magic: the Gathering",
    desc: "Decks, cards & collection browser",
    hue: 200,
  },
  {
    href: "/boardgames/index.html",
    emoji: "🎲",
    title: "Board Games",
    desc: "Collection tracker & session log",
    hue: 140,
  },
  {
    href: "/tt-minis/index.html",
    emoji: "⚒️",
    title: "TT Miniatures",
    desc: "Projects, painting log & gallery",
    hue: 340,
  },
  {
    href: "/recipes/index.html",
    emoji: "🥘",
    title: "Recipes",
    desc: "Saved recipes & meal ideas",
    hue: 50,
  },
  {
    href: "/inventory",
    emoji: "📦",
    title: "Inventory",
    desc: "Physical item tracker & storage manager",
    hue: 260,
  },
  {
    href: "/steam",
    emoji: "🎮",
    title: "Game Night",
    desc: "Find games your whole crew owns on Steam & let fate pick",
    hue: 160,
    featured: true,
    badge: "New",
  },
  {
    href: "/bookmarks",
    emoji: "🔖",
    title: "Bookmarks",
    desc: "Saved links, tools & resources — importable from any browser",
    hue: 300,
  },
  {
    href: "https://mytimeliner.app",
    emoji: "⏳",
    title: "Timeline",
    desc: "Chronicle of events & milestones",
    hue: 185,
    external: true,
  },
] as const;

export default function HubPage() {
  // Start with dark — will sync from localStorage after mount (no null flash)
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("hub-theme") as "dark" | "light" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(saved ?? (prefersDark ? "dark" : "light"));
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("hub-theme", next);
      return next;
    });
  };

  const d = theme === "dark";

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Already have a session, set cookie and stay
        document.cookie = 'sb-session=1; path=/; max-age=3600; SameSite=Lax';
        return;
      }
      // Check if there's a hash token to process (implicit flow landing here)
      if (window.location.hash.includes('access_token')) {
        document.cookie = 'sb-session=1; path=/; max-age=3600; SameSite=Lax';
        // Remove the hash from URL without reload
        window.history.replaceState(null, '', '/');
        return;
      }
      // No session at all
      document.cookie = 'sb-session=; path=/; max-age=0';
      window.location.href = '/auth/login';
    });
  }, []);

  // Design tokens — all colours live here, nothing touches body/html
  const bg       = d ? "#0f0e0c"                : "#f7f4ef";
  const surface  = d ? "#1c1a17"                : "#ffffff";
  const surface2 = d ? "#242118"                : "#f4f1eb";
  const border   = d ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const text     = d ? "#f0ece4"                : "#1a1714";
  const text2    = d ? "#9c9487"                : "#6b6358";
  const text3    = d ? "#5c5750"                : "#b0a89c";
  const shadow   = d
    ? "0 2px 8px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.35)"
    : "0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06)";
  const shadowHover = d
    ? "0 4px 16px rgba(0,0,0,0.6), 0 16px 48px rgba(0,0,0,0.4)"
    : "0 4px 12px rgba(0,0,0,0.1), 0 12px 40px rgba(0,0,0,0.08)";

  return (
    // ↓ This single div IS the entire page — sets bg, min height covers viewport
    <div style={{
      background: bg,
      minHeight: "100vh",
      width: "100%",
      color: text,
      fontFamily: "'Crimson Pro', Georgia, serif",
      transition: "background 0.3s, color 0.3s",
      position: "relative",
    }}>

      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&family=DM+Mono:wght@400;500&display=swap');

        /* Scoped card animation + hover effects */
        .hub-card {
          opacity: 0;
          animation: hubCardIn 0.5s cubic-bezier(0.22,1,0.36,1) forwards;
        }
        @keyframes hubCardIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hub-card:hover {
          transform: translateY(-4px) scale(1.015) !important;
        }
        .hub-card:hover .hub-glyph {
          transform: scale(1.12) rotate(-4deg) !important;
          background: var(--glyph-hover) !important;
        }
        .hub-card:hover .hub-arrow {
          transform: translateX(4px) !important;
          color: var(--accent-color) !important;
        }
        .hub-card:hover .hub-bar { opacity: 1 !important; }

        /* Noise grain overlay */
        .hub-noise {
          position: fixed; inset: 0; pointer-events: none; z-index: 999;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 200px 200px;
        }

        .hub-theme-btn {
          transition: background 0.2s, color 0.2s, transform 0.15s !important;
        }
        .hub-theme-btn:hover {
          transform: scale(1.1) rotate(15deg) !important;
        }

        @media (max-width: 600px) {
          .hub-header-inner { padding: 52px 20px 44px !important; }
          .hub-grid { padding: 24px 14px 48px !important; gap: 10px !important; }
          .hub-deco { display: none !important; }
        }
      `}</style>

      {/* Grain overlay */}
      <div className="hub-noise" aria-hidden style={{ opacity: d ? 0.035 : 0.022 }} />

      {/* Theme toggle */}
      <button
        className="hub-theme-btn"
        onClick={toggleTheme}
        title="Toggle theme"
        style={{
          position: "fixed", top: 20, right: 20, zIndex: 200,
          width: 40, height: 40, borderRadius: "50%",
          border: `1px solid ${border}`,
          background: surface2, color: text2,
          fontSize: 17, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: shadow,
        }}
      >
        {d ? "☽" : "☀"}
      </button>

      {/* ── Header ── */}
      <header style={{ position: "relative", borderBottom: `1px solid ${border}`, overflow: "hidden" }}>
        {/* Decorative circles — purely visual */}
        <div className="hub-deco" aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}>
          {([
            { w: 500, h: 500, right: -120, top: -200, hue: 28 },
            { w: 300, h: 300, right: 80,   bottom: -100, hue: 200 },
            { w: 180, h: 180, right: 300,  top: 20, hue: 0 },
          ] as const).map((c, i) => (
            <div key={i} style={{
              position: "absolute",
              width: c.w, height: c.h,
              right: c.right,
              top:    "top"    in c ? c.top    : undefined,
              bottom: "bottom" in c ? c.bottom : undefined,
              borderRadius: "50%",
              border: `1px solid ${border}`,
              background: c.hue
                ? `radial-gradient(circle at 40% 40%, hsla(${c.hue},70%,50%,${d ? 0.07 : 0.05}) 0%, transparent 65%)`
                : "transparent",
            }} />
          ))}
        </div>

        <div className="hub-header-inner" style={{ position: "relative", zIndex: 2, padding: "80px 40px 72px", maxWidth: 640 }}>
          <p style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 12, letterSpacing: "0.18em",
            textTransform: "uppercase", color: text3, marginBottom: 18,
          }}>
            Welcome back
          </p>

          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "clamp(56px, 9vw, 104px)",
            fontWeight: 900, lineHeight: 0.92,
            letterSpacing: "-0.02em", color: text, marginBottom: 24,
          }}>
            Daniel&apos;s<br />
            <em style={{
              fontStyle: "italic", fontWeight: 700,
              color: d ? "#e8c97a" : "#c8900a",
            }}>Hub</em>
          </h1>

          <p style={{ fontSize: 18, color: text2, fontStyle: "italic" }}>
            Pick a branch and dive in.
          </p>
        </div>
      </header>

      {/* ── Card grid ── */}
      <main
        className="hub-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 16,
          maxWidth: 1100,
          margin: "0 auto",
          padding: "48px 32px 64px",
        }}
      >
        {links.map((link, i) => {
          const accentL    = d ? 60 : 42;
          const accent     = `hsl(${link.hue}, 65%, ${accentL}%)`;
          const isSmall    = "small"    in link && link.small;
          const isFeatured = "featured" in link && link.featured;
          const isExternal = "external" in link && link.external;
          const badge      = "badge"    in link ? link.badge : undefined;

          return (
            <a
              key={link.href}
              href={link.href}
              target={isExternal ? "_blank" : undefined}
              rel={isExternal ? "noopener noreferrer" : undefined}
              className="hub-card"
              style={{
                // CSS custom props for hover CSS rules above
                ["--accent-color" as string]: accent,
                ["--glyph-hover"  as string]: `hsla(${link.hue},60%,50%,0.14)`,

                animationDelay: `${i * 55 + 80}ms`,
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "20px 18px",
                background: isFeatured
                  ? `linear-gradient(135deg, ${surface} 0%, hsla(${link.hue},40%,50%,${d ? 0.1 : 0.06}) 100%)`
                  : surface,
                border: `1px solid ${isFeatured ? `hsla(${link.hue},50%,50%,0.28)` : border}`,
                borderRadius: 14,
                textDecoration: "none",
                color: text,
                boxShadow: shadow,
                position: "relative",
                overflow: "hidden",
                opacity: isSmall ? 0.72 : undefined,
                transition: "transform 0.22s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.22s, border-color 0.18s, background 0.25s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = shadowHover;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = shadow;
              }}
            >
              {/* Left accent bar */}
              <div className="hub-bar" style={{
                position: "absolute", left: 0, top: 14, bottom: 14,
                width: 3, borderRadius: "0 2px 2px 0",
                background: accent, opacity: 0,
                transition: "opacity 0.2s", pointerEvents: "none",
              }} />

              {/* "New" badge */}
              {badge && (
                <span style={{
                  position: "absolute", top: -8, right: 14,
                  background: accent, color: "#fff",
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10, letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  padding: "2px 8px", borderRadius: 100,
                  boxShadow: `0 2px 6px hsla(${link.hue},50%,30%,0.4)`,
                }}>
                  {badge}
                </span>
              )}

              {/* Emoji glyph */}
              <div className="hub-glyph" style={{
                fontSize: isSmall ? 22 : 28,
                flexShrink: 0,
                width: isSmall ? 42 : 50,
                height: isSmall ? 42 : 50,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: surface2,
                borderRadius: 12,
                border: `1px solid ${border}`,
                transition: "transform 0.25s cubic-bezier(0.34,1.56,0.64,1), background 0.2s",
              }}>
                {link.emoji}
              </div>

              {/* Title + description */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: isSmall ? 15 : 17,
                  fontWeight: 700, color: text,
                  marginBottom: 3, lineHeight: 1.2,
                }}>
                  {link.title}
                </div>
                <div style={{
                  fontSize: 13, color: text2,
                  lineHeight: 1.5, fontStyle: "italic",
                }}>
                  {link.desc}
                </div>
              </div>

              {/* Arrow */}
              <span className="hub-arrow" style={{
                fontSize: 16, color: text3, flexShrink: 0,
                fontFamily: "'DM Mono', monospace",
                transition: "transform 0.2s, color 0.2s",
              }}>
                →
              </span>
            </a>
          );
        })}
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: "center", padding: 24,
        fontFamily: "'DM Mono', monospace",
        fontSize: 11, letterSpacing: "0.12em",
        color: text3, borderTop: `1px solid ${border}`,
      }}>
        danielhallberg.com
      </footer>
    </div>
  );
}
