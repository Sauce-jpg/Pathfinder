"use client";

import { useEffect, useState } from "react";

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
    href: "/other/index.html",
    emoji: "🧭",
    title: "Other",
    desc: "Miscellaneous links & tools",
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

type Link = typeof links[number];

export default function HubPage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("hub-theme") as "dark" | "light" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = saved ?? (prefersDark ? "dark" : "light");
    setTheme(initial);
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("hub-theme", next);
  };

  if (!mounted) return null;

  const d = theme === "dark";

  const t = {
    bg:          d ? "#0f0e0c"                  : "#f7f4ef",
    surface:     d ? "#1c1a17"                  : "#ffffff",
    surface2:    d ? "#242118"                  : "#f4f1eb",
    border:      d ? "rgba(255,255,255,0.08)"   : "rgba(0,0,0,0.08)",
    text:        d ? "#f0ece4"                  : "#1a1714",
    text2:       d ? "#9c9487"                  : "#6b6358",
    text3:       d ? "#5c5750"                  : "#b0a89c",
    shadow:      d
      ? "0 2px 8px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.35)"
      : "0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06)",
    shadowHover: d
      ? "0 4px 16px rgba(0,0,0,0.6), 0 16px 48px rgba(0,0,0,0.4)"
      : "0 4px 12px rgba(0,0,0,0.1), 0 12px 40px rgba(0,0,0,0.08)",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&family=DM+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: ${t.bg} !important;
          font-family: 'Crimson Pro', Georgia, serif;
          transition: background 0.3s;
        }

        .hub-noise {
          position: fixed; inset: 0; pointer-events: none; z-index: 999;
          opacity: ${d ? 0.035 : 0.025};
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 200px 200px;
        }

        .hub-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px 18px;
          background: ${t.surface};
          border: 1px solid ${t.border};
          border-radius: 14px;
          text-decoration: none;
          color: ${t.text};
          box-shadow: ${t.shadow};
          position: relative;
          overflow: hidden;
          transition:
            transform 0.22s cubic-bezier(0.34,1.56,0.64,1),
            box-shadow 0.22s ease,
            border-color 0.18s ease,
            background 0.25s;
          opacity: 0;
          animation: cardIn 0.5s cubic-bezier(0.22,1,0.36,1) forwards;
        }

        .hub-card:hover {
          transform: translateY(-4px) scale(1.015);
          box-shadow: ${t.shadowHover};
        }

        .hub-card:hover .hub-card-glyph { transform: scale(1.12) rotate(-4deg); }
        .hub-card:hover .hub-card-arrow { transform: translateX(4px); }
        .hub-card:hover .hub-card-bar   { opacity: 1 !important; }

        .hub-card:hover .hub-card-glyph {
          background: var(--glyph-hover-bg) !important;
        }

        @keyframes cardIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .hub-theme-btn:hover {
          transform: scale(1.1) rotate(15deg) !important;
          color: ${t.text} !important;
        }

        @media (max-width: 600px) {
          .hub-header { padding: 52px 20px 44px !important; }
          .hub-grid   { padding: 28px 14px 48px !important; gap: 10px !important; }
          .hub-deco   { display: none !important; }
        }
      `}</style>

      <div className="hub-noise" aria-hidden />

      {/* Theme toggle */}
      <button
        className="hub-theme-btn"
        onClick={toggleTheme}
        title="Toggle theme"
        style={{
          position: "fixed", top: 20, right: 20, zIndex: 200,
          width: 40, height: 40, borderRadius: "50%",
          border: `1px solid ${t.border}`,
          background: t.surface2, color: t.text2,
          fontSize: 16, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: t.shadow,
          transition: "background 0.2s, color 0.2s, transform 0.15s",
        }}
      >
        {d ? "☽" : "☀"}
      </button>

      {/* Header */}
      <header
        className="hub-header"
        style={{
          position: "relative",
          padding: "80px 40px 72px",
          borderBottom: `1px solid ${t.border}`,
          overflow: "hidden",
          background: t.bg,
        }}
      >
        {/* Decorative circles */}
        <div className="hub-deco" aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}>
          {[
            { w: 500, h: 500, r: -120, top: -200, hue: 28 },
            { w: 300, h: 300, r: 80,   top: undefined, bottom: -100, hue: 200 },
            { w: 180, h: 180, r: 300,  top: 20, hue: 0 },
          ].map((c, i) => (
            <div key={i} style={{
              position: "absolute",
              width: c.w, height: c.h,
              right: c.r,
              top: c.top ?? undefined,
              bottom: (c as any).bottom ?? undefined,
              borderRadius: "50%",
              border: `1px solid ${t.border}`,
              background: c.hue
                ? `radial-gradient(circle at 40% 40%, hsla(${c.hue},70%,50%,${d ? 0.07 : 0.05}) 0%, transparent 65%)`
                : "transparent",
            }} />
          ))}
        </div>

        <div style={{ position: "relative", zIndex: 2, maxWidth: 640 }}>
          <p style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: t.text3,
            marginBottom: 18,
          }}>
            Welcome back
          </p>

          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "clamp(56px, 9vw, 104px)",
            fontWeight: 900,
            lineHeight: 0.92,
            letterSpacing: "-0.02em",
            color: t.text,
            marginBottom: 24,
          }}>
            Daniel&apos;s<br />
            <em style={{
              fontStyle: "italic",
              fontWeight: 700,
              background: d
                ? "linear-gradient(135deg, #e8c97a 0%, #d4874a 100%)"
                : "linear-gradient(135deg, #c8900a 0%, #b05a1a 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>Hub</em>
          </h1>

          <p style={{ fontSize: 18, color: t.text2, fontStyle: "italic" }}>
            Pick a branch and dive in.
          </p>
        </div>
      </header>

      {/* Grid */}
      <main
        className="hub-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 16,
          maxWidth: 1100,
          margin: "0 auto",
          padding: "48px 32px 64px",
          background: t.bg,
        }}
      >
        {links.map((link, i) => {
          const accentL = d ? 60 : 42;
          const accent = `hsl(${link.hue}, 65%, ${accentL}%)`;
          const isSmall = "small" in link && link.small;
          const isFeatured = "featured" in link && link.featured;
          const isExternal = "external" in link && link.external;
          const badge = "badge" in link ? link.badge : undefined;

          return (
            <a
              key={link.href}
              href={link.href}
              target={isExternal ? "_blank" : undefined}
              rel={isExternal ? "noopener noreferrer" : undefined}
              className="hub-card"
              style={{
                animationDelay: `${i * 60 + 80}ms`,
                opacity: isSmall ? 0.72 : undefined,
                background: isFeatured
                  ? `linear-gradient(135deg, ${t.surface} 0%, hsla(${link.hue},40%,50%,${d ? 0.1 : 0.06}) 100%)`
                  : t.surface,
                borderColor: isFeatured
                  ? `hsla(${link.hue},50%,50%,0.28)`
                  : t.border,
                // expose for glyph hover
                ["--glyph-hover-bg" as string]: `hsla(${link.hue},60%,50%,0.14)`,
              }}
            >
              {/* Accent bar */}
              <div
                className="hub-card-bar"
                style={{
                  position: "absolute",
                  left: 0, top: 14, bottom: 14,
                  width: 3,
                  borderRadius: "0 2px 2px 0",
                  background: accent,
                  opacity: 0,
                  transition: "opacity 0.2s",
                  pointerEvents: "none",
                }}
              />

              {/* Badge */}
              {badge && (
                <span style={{
                  position: "absolute",
                  top: -8, right: 14,
                  background: accent,
                  color: "#fff",
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  padding: "2px 8px",
                  borderRadius: 100,
                  boxShadow: `0 2px 6px hsla(${link.hue},50%,30%,0.4)`,
                }}>
                  {badge}
                </span>
              )}

              {/* Glyph */}
              <div
                className="hub-card-glyph"
                style={{
                  fontSize: isSmall ? 22 : 28,
                  flexShrink: 0,
                  width: isSmall ? 42 : 50,
                  height: isSmall ? 42 : 50,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: t.surface2,
                  borderRadius: 12,
                  border: `1px solid ${t.border}`,
                  transition: "transform 0.25s cubic-bezier(0.34,1.56,0.64,1), background 0.2s",
                }}
              >
                {link.emoji}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: isSmall ? 15 : 17,
                  fontWeight: 700,
                  color: t.text,
                  marginBottom: 3,
                  lineHeight: 1.2,
                }}>
                  {link.title}
                </div>
                <div style={{
                  fontSize: 13,
                  color: t.text2,
                  lineHeight: 1.5,
                  fontStyle: "italic",
                }}>
                  {link.desc}
                </div>
              </div>

              {/* Arrow */}
              <span
                className="hub-card-arrow"
                style={{
                  fontSize: 16,
                  color: t.text3,
                  flexShrink: 0,
                  fontFamily: "'DM Mono', monospace",
                  transition: "transform 0.2s, color 0.2s",
                }}
              >
                →
              </span>
            </a>
          );
        })}
      </main>

      <footer style={{
        textAlign: "center",
        padding: 24,
        fontFamily: "'DM Mono', monospace",
        fontSize: 11,
        letterSpacing: "0.12em",
        color: t.text3,
        borderTop: `1px solid ${t.border}`,
        background: t.bg,
      }}>
        danielhallberg.com
      </footer>
    </>
  );
}
