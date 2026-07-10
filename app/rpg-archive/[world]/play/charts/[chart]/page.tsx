'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from '../../../charts/charts.module.css';
import playStyles from '../../play.module.css';

type World = {
  id: string;
  name: string;
  slug: string;
  appearance: { accent?: string };
};

type Column = { id: string; label: string; group?: string };

type PlayerCell = {
  text?: string;
  entityId?: string;
  name?: string;
  slug?: string;
  masked?: boolean;
};

type PlayerChart = {
  id: string;
  name: string;
  description: string | null;
  columns: Column[];
  rows: PlayerCell[][];
};

function PlayChartPageInner() {
  const params = useParams<{ world: string; chart: string }>();
  const { world: worldSlug, chart: chartId } = params;
  const searchParams = useSearchParams();
  const viewAs = searchParams.get('as');

  const [world, setWorld] = useState<World | null>(null);
  const [chart, setChart] = useState<PlayerChart | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: w, error: wErr } = await supabase
      .from('ra_worlds')
      .select('id, name, slug, appearance')
      .eq('slug', worldSlug)
      .single();

    if (wErr || !w) {
      setError(wErr?.message ?? 'World not found or no access.');
      setLoading(false);
      return;
    }
    setWorld(w as World);

    if (viewAs) {
      const { data: nm } = await supabase.rpc('hub_user_names', {
        p_ids: [viewAs],
      });
      setPreviewName(
        ((nm as { display_name: string }[]) ?? [])[0]?.display_name ?? null
      );
    }

    const { data, error } = await supabase.rpc('ra_player_get_chart', {
      p_world_id: w.id,
      p_chart_id: chartId,
      p_view_as: viewAs,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setChart(((data as PlayerChart[]) ?? [])[0] ?? null);
    setLoading(false);
  }, [worldSlug, chartId, viewAs]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const accent = world?.appearance?.accent || '#c8900a';
  const columns = chart?.columns ?? [];
  const hasGroups = columns.some((c) => (c.group ?? '').trim() !== '');

  function groupSpans(): { label: string; span: number }[] {
    const spans: { label: string; span: number }[] = [];
    for (const col of columns) {
      const g = col.group?.trim() || '';
      const last = spans[spans.length - 1];
      if (last && last.label === g) last.span += 1;
      else spans.push({ label: g, span: 1 });
    }
    return spans;
  }

  const previewBanner = viewAs ? (
    <div className={playStyles.previewBanner}>
      <span>
        👁 Previewing as {previewName ?? 'player'} — this is exactly what
        they see.
      </span>
      <Link
        href={`/rpg-archive/${worldSlug}`}
        className={playStyles.previewExit}
      >
        Exit preview
      </Link>
    </div>
  ) : null;

  if (loading) {
    return (
      <div className={styles.wrap}>
        <p className={styles.muted}>Loading…</p>
      </div>
    );
  }

  if (!world || !chart) {
    return (
      <div className={styles.wrap}>
        {previewBanner}
        <div className={styles.empty}>
          <p>This chart has not been revealed to you.</p>
          <p className={styles.muted}>
            {error ?? 'Ask your GM — or discover it in play.'}
          </p>
        </div>
        <p style={{ marginTop: '1rem' }}>
          <Link
            href={`/rpg-archive/${worldSlug}/play${
              viewAs ? `?as=${viewAs}` : ''
            }`}
            className={styles.backLink}
          >
            ← Back to the archive
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className={styles.wrap} style={{ ['--ra-accent' as string]: accent }}>
      <Link
        href={`/rpg-archive/${worldSlug}/play${
          viewAs ? `?as=${viewAs}` : ''
        }`}
        className={styles.backLink}
      >
        ← {world.name}
      </Link>

      {previewBanner}

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{chart.name}</h1>
          {chart.description && (
            <p className={styles.subtitle}>{chart.description}</p>
          )}
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.tableScroll}>
        <table className={styles.chartTable}>
          <thead>
            {hasGroups && (
              <tr>
                {groupSpans().map((g, i) => (
                  <th key={i} colSpan={g.span} className={styles.groupHeader}>
                    {g.label}
                  </th>
                ))}
              </tr>
            )}
            <tr>
              {columns.map((c) => (
                <th key={c.id} className={styles.colHeader}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(chart.rows ?? []).map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className={styles.cell}>
                    {cell.masked ? (
                      <span className={styles.maskedCell}>???</span>
                    ) : cell.entityId && cell.slug ? (
                      <Link
                        href={`/rpg-archive/${worldSlug}/play/${cell.slug}${
                          viewAs ? `?as=${viewAs}` : ''
                        }`}
                        className={styles.cellLink}
                      >
                        {cell.name}
                      </Link>
                    ) : (
                      cell.text
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PlayChartPage() {
  return (
    <Suspense fallback={<div />}>
      <PlayChartPageInner />
    </Suspense>
  );
}
