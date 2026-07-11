'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from '../charts/charts.module.css';

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

/**
 * A group name covers its own column and every following column until the
 * next group name. Use "-" as a group name to explicitly end a group.
 */
export function computeGroupSpans(
  columns: Column[]
): { label: string; span: number }[] {
  const spans: { label: string; span: number }[] = [];
  let started = false;
  for (const col of columns) {
    const raw = (col.group ?? '').trim();
    if (raw !== '') {
      spans.push({ label: raw === '-' ? '' : raw, span: 1 });
      started = true;
    } else if (spans.length === 0 || !started) {
      if (spans.length === 0) spans.push({ label: '', span: 1 });
      else spans[spans.length - 1].span += 1;
    } else {
      spans[spans.length - 1].span += 1;
    }
  }
  return spans;
}

type Props = {
  worldId: string;
  worldSlug: string;
  chartId: string;
  viewAs: string | null;
  /** Smaller title styling when embedded inside an entity page. */
  embed?: boolean;
};

export default function PlayerChartTable({
  worldId,
  worldSlug,
  chartId,
  viewAs,
  embed,
}: Props) {
  const [chart, setChart] = useState<PlayerChart | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.rpc('ra_player_get_chart', {
      p_world_id: worldId,
      p_chart_id: chartId,
      p_view_as: viewAs,
    });
    setChart(((data as PlayerChart[]) ?? [])[0] ?? null);
    setLoading(false);
  }, [worldId, chartId, viewAs]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className={styles.muted}>Loading chart…</p>;
  }

  if (!chart) {
    return (
      <div className={styles.empty}>
        <p>This chart has not been revealed to you.</p>
      </div>
    );
  }

  const columns = chart.columns ?? [];
  const hasGroups = columns.some((c) => (c.group ?? '').trim() !== '');
  const spans = computeGroupSpans(columns);

  return (
    <div>
      {embed ? (
        <h2 className={styles.embedTitle}>{chart.name}</h2>
      ) : (
        <h1 className={styles.title}>{chart.name}</h1>
      )}
      {chart.description && (
        <p className={embed ? styles.embedDesc : styles.subtitle}>
          {chart.description}
        </p>
      )}
      <div className={styles.tableScroll} style={{ marginTop: '0.75rem' }}>
        <table className={styles.chartTable}>
          <thead>
            {hasGroups && (
              <tr>
                {spans.map((g, i) => (
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
