'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from './play.module.css';

type World = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  appearance: { accent?: string };
};

type VisibleEntity = {
  id: string;
  name: string;
  slug: string;
  subtype: string | null;
  type_name: string;
  type_icon: string | null;
  type_color: string | null;
};

export default function PlayPage() {
  const params = useParams<{ world: string }>();
  const worldSlug = params.world;

  const [world, setWorld] = useState<World | null>(null);
  const [entities, setEntities] = useState<VisibleEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: w, error: wErr } = await supabase
      .from('ra_worlds')
      .select('id, name, slug, description, appearance')
      .eq('slug', worldSlug)
      .single();

    if (wErr || !w) {
      setError(wErr?.message ?? 'World not found or no access.');
      setLoading(false);
      return;
    }
    setWorld(w as World);

    const { data, error } = await supabase.rpc('ra_player_list_entities', {
      p_world_id: w.id,
    });

    if (error) setError(error.message);
    else setEntities((data as VisibleEntity[]) ?? []);
    setLoading(false);
  }, [worldSlug]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const accent = world?.appearance?.accent || '#c8900a';

  const typeNames = Array.from(
    new Set(entities.map((e) => e.type_name))
  ).sort();

  const visible = entities.filter((e) => {
    if (typeFilter && e.type_name !== typeFilter) return false;
    if (search && !e.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  if (loading) {
    return (
      <div className={styles.wrap}>
        <p className={styles.muted}>Loading…</p>
      </div>
    );
  }

  if (!world) {
    return (
      <div className={styles.wrap}>
        <div className={styles.error}>{error ?? 'No access.'}</div>
        <Link href="/rpg-archive" className={styles.backLink}>
          ← All Worlds
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.wrap} style={{ ['--ra-accent' as string]: accent }}>
      <Link href="/rpg-archive" className={styles.backLink}>
        ← All Worlds
      </Link>

      <header className={styles.header}>
        <p className={styles.kicker}>Player Archive</p>
        <h1 className={styles.title}>{world.name}</h1>
        {world.description && (
          <p className={styles.subtitle}>{world.description}</p>
        )}
      </header>

      {error && <div className={styles.error}>{error}</div>}

      {entities.length > 0 && (
        <div className={styles.toolbar}>
          <div className={styles.pillRow}>
            <button
              className={`${styles.pill} ${
                typeFilter === null ? styles.pillActive : ''
              }`}
              onClick={() => setTypeFilter(null)}
            >
              All ({entities.length})
            </button>
            {typeNames.map((t) => {
              const count = entities.filter(
                (e) => e.type_name === t
              ).length;
              return (
                <button
                  key={t}
                  className={`${styles.pill} ${
                    typeFilter === t ? styles.pillActive : ''
                  }`}
                  onClick={() =>
                    setTypeFilter(typeFilter === t ? null : t)
                  }
                >
                  {t} ({count})
                </button>
              );
            })}
          </div>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {visible.length === 0 ? (
        <div className={styles.empty}>
          <p>
            {entities.length === 0
              ? 'Nothing has been revealed to you yet.'
              : 'Nothing matches the current filter.'}
          </p>
          {entities.length === 0 && (
            <p className={styles.muted}>
              As your journey through {world.name} continues, the GM will
              reveal knowledge here — piece by piece.
            </p>
          )}
        </div>
      ) : (
        <div className={styles.entityGrid}>
          {visible.map((e) => (
            <Link
              key={e.id}
              href={`/rpg-archive/${worldSlug}/play/${e.slug}`}
              className={styles.entityCard}
              style={{ borderLeftColor: e.type_color || accent }}
            >
              <span className={styles.entityIcon}>{e.type_icon || '◆'}</span>
              <span className={styles.entityName}>{e.name}</span>
              <span className={styles.entityMeta}>
                {e.type_name}
                {e.subtype && ` · ${e.subtype}`}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
