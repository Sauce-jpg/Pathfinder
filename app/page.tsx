export default function Home() {
  const links = [
    { href: "/pathfinder", label: "⚔️ Pathfinder" },
    { href: "/pathfinder/index.html", label: "⚔️ Pathfinder (Legacy since 14-02-2026)" },
    { href: "/mtg/index.html", label: "🃏 Magic the Gathering" },
    { href: "/boardgames/index.html", label: "🎲 Boardgames" },
    { href: "/tt-minis/index.html", label: "⚒️ TT Miniatures" },
    { href: "/recipes/index.html", label: "🥘 Recipes" },
    { href: "/inventory", label: "📦 Inventory (App)" },
    { href: "/other/index.html", label: "🧭 Other" },
    { href: "https://timeline-sauces-projects-a91ee751.vercel.app", label: "⏳ Timeline" }
  ];

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem" }}>
      <h1>Daniel's Hub</h1>
      <p>Select a branch:</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
          marginTop: "1rem"
        }}
      >
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            style={{
              padding: "1rem",
              borderRadius: 12,
              background: "rgba(0,0,0,0.06)",
              textDecoration: "none",
              color: "inherit"
            }}
          >
            {l.label}
          </a>
        ))}
      </div>
    </main>
  );
}
