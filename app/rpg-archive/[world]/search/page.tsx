'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from './search.module.css';

type World = {
  id: string;
  name: string;
  slug: string;
  appearance: { accent?: string };
};

type Result = {
  kind: 'entity' | 'asset' | 'campaign' | 'session' | 'quest';
  id: string;
  name: string;
  slug: string | null;
  context: string | null;
  campaign_slug: string | null;
};

const KIND_LABELS: Record<string, string> = {
  entity: 'Entities',
  asset: 'Assets',
  campaign: 'Campaigns',
  session: 'Sessions',
  quest: 'Quests',
};

const KIND_ORDER: Result['kind'][] = [
  'entity',
  'campaign',
  'session',
  'quest',
  'asset',
];

export default function SearchPage() {
  const params = useParams<{ world: string }>();
  const worldSlug = params.world;

  const [world, setWorld] = useState<World | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<string | null>(null);

  const loadWorld = useCallback(async () => {
    const { data, error } = await supabase
      .from('ra_worlds')
      .select('id, name, slug, appearance')
      .eq('slug', worldSlug)
      .single();
    if (error || !data) setError(error?.message ?? 'World not found.');
    else setWorld(data as World);
  }, [worldSlug]);

  useEffect(() => {
    loadWorld();
  }, [loadWorld]);

  async function runSearch() {
    if (!world) return;
    const q = query.trim();
    if (q.length < 2) {
      setError('Enter at least two characters.');
      return;
    }
    setLoading(true);
    setError(null);
    setKindFilter(null);

    const { data, error } = await supabase.rpc('ra_search', {
      p_world_id: world.id,
      p_query: q,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setResults((data as Result[]) ?? []);
    setSearched(true);
  }

  function resultHref(r: Result): string {
    switch (r.kind) {
      case 'entity':
        return `/rpg-archive/${worldSlug}/archive/${r.slug}`;
      case 'asset':
        return `/rpg-archive/${worldSlug}/assets`;
      case 'campaign':
        return `/rpg-archive/${worldSlug}/campaigns/${r.slug}`;
      case 'session':
      case 'quest':
        return `/rpg-archive/${worldSlug}/campaigns/${r.campaign_slug}`;
    }
  }

  const accent = world?.appearance?.accent || '#c8900a';

  const visible = kindFilter
    ? results.filter((r) => r.kind === kindFilter)
    : results;

  const grouped = KIND_ORDER.map((kind) => ({
    kind,
    items: visible
      .filter((r) => r.kind === kind)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className={styles.wrap} style={{ ['--ra-accent' as string]: accent }}>
      <Link href={`/rpg-archive/${worldSlug}`} className={styles.backLink}>
        ← {world?.name ?? 'World'}
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>Search</h1>
        <p className={styles.subtitle}>
          Names, structured fields, documentation, notes — one query across
          the whole world.
        </p>
      </header>

      <div className={styles.searchBar}>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Sunny, Fire Keepers, forgotten shore…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') runSearch();
          }}
          autoFocus
        />
        <button
          className={styles.primaryBtn}
          onClick={runSearch}
          disabled={loading || !world}
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {searched && results.length > 0 && (
        <div className={styles.pillRow}>
          <button
            className={`${styles.pill} ${
              kindFilter === null ? styles.pillActive : ''
            }`}
            onClick={() => setKindFilter(null)}
          >
            All ({results.length})
          </button>
          {KIND_ORDER.map((kind) => {
            const count = results.filter((r) => r.kind === kind).length;
            if (count === 0) return null;
            return (
              <button
                key={kind}
                className={`${styles.pill} ${
                  kindFilter === kind ? styles.pillActive : ''
                }`}
                onClick={() =>
                  setKindFilter(kindFilter === kind ? null : kind)
                }
              >
                {KIND_LABELS[kind]} ({count})
              </button>
            );
          })}
        </div>
      )}

      {searched && results.length === 0 && !loading && (
        <div className={styles.empty}>
          <p>No matches for “{query.trim()}”.</p>
          <p className={styles.muted}>
            Search covers entity names, fields, and documentation, plus
            assets, campaigns, session notes, and quests.
          </p>
        </div>
      )}

      {grouped.map((g) => (
        <div key={g.kind} className={styles.group}>
          <h2 className={styles.groupTitle}>{KIND_LABELS[g.kind]}</h2>
          {g.items.map((r) => (
            <Link
              key={`${r.kind}-${r.id}`}
              href={resultHref(r)}
              className={styles.resultRow}
            >
              <span className={styles.resultName}>{r.name}</span>
              {r.context && (
                <span className={styles.resultContext}>{r.context}</span>
              )}
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}
