'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from './charts.module.css';

type World = {
  id: string;
  name: string;
  slug: string;
  appearance: { accent?: string };
};

type Chart = {
  id: string;
  name: string;
  description: string | null;
  columns: unknown[];
  rows: unknown[];
  updated_at: string;
};

export default function ChartsPage() {
  const params = useParams<{ world: string }>();
  const worldSlug = params.world;
  const router = useRouter();

  const [world, setWorld] = useState<World | null>(null);
  const [charts, setCharts] = useState<Chart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: w, error: wErr } = await supabase
      .from('ra_worlds')
      .select('id, name, slug, appearance')
      .eq('slug', worldSlug)
      .single();

    if (wErr || !w) {
      setError(wErr?.message ?? 'World not found.');
      setLoading(false);
      return;
    }
    setWorld(w as World);

    const { data, error } = await supabase
      .from('ra_charts')
      .select('id, name, description, columns, rows, updated_at')
      .eq('world_id', w.id)
      .order('name', { ascending: true });

    if (error) setError(error.message);
    else setCharts((data as Chart[]) ?? []);
    setLoading(false);
  }, [worldSlug]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const accent = world?.appearance?.accent || '#c8900a';

  async function createChart() {
    if (!world || !newName.trim()) return;
    setSaving(true);
    setError(null);
    const { data, error } = await supabase
      .from('ra_charts')
      .insert({
        world_id: world.id,
        name: newName.trim(),
        columns: [
          { id: crypto.randomUUID(), label: 'Column 1' },
          { id: crypto.randomUUID(), label: 'Column 2' },
        ],
        rows: [[{ text: '' }, { text: '' }]],
      })
      .select('id')
      .single();
    setSaving(false);
    if (error || !data) {
      setError(error?.message ?? 'Could not create chart.');
      return;
    }
    router.push(`/rpg-archive/${worldSlug}/charts/${data.id}`);
  }

  if (loading) {
    return (
      <div className={styles.wrap}>
        <p className={styles.muted}>Loading charts…</p>
      </div>
    );
  }

  if (!world) {
    return (
      <div className={styles.wrap}>
        <div className={styles.error}>{error ?? 'World not found.'}</div>
        <Link href="/rpg-archive" className={styles.backLink}>
          ← All Worlds
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.wrap} style={{ ['--ra-accent' as string]: accent }}>
      <Link href={`/rpg-archive/${worldSlug}`} className={styles.backLink}>
        ← {world.name}
      </Link>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Charts</h1>
          <p className={styles.subtitle}>
            Reference tables where every cell can link to an entity — rank
            charts, pantheons, hierarchies.
          </p>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.createRow}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Soul Core Ranks…"
          onKeyDown={(e) => {
            if (e.key === 'Enter') createChart();
          }}
        />
        <button
          className={styles.primaryBtn}
          onClick={createChart}
          disabled={saving || !newName.trim()}
        >
          + New Chart
        </button>
      </div>

      {charts.length === 0 ? (
        <div className={styles.empty}>
          <p>No charts yet.</p>
          <p className={styles.muted}>
            Build your first reference table — like a rank chart where every
            rank links to its entity.
          </p>
        </div>
      ) : (
        <div className={styles.chartGrid}>
          {charts.map((c) => (
            <Link
              key={c.id}
              href={`/rpg-archive/${worldSlug}/charts/${c.id}`}
              className={styles.chartCard}
            >
              <span className={styles.chartName}>{c.name}</span>
              {c.description && (
                <span className={styles.chartDesc}>{c.description}</span>
              )}
              <span className={styles.chartMeta}>
                {(c.columns ?? []).length} columns ·{' '}
                {(c.rows ?? []).length} rows
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
