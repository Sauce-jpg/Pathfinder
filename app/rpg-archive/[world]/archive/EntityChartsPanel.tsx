'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from './archive.module.css';

type ChartLink = {
  id: string;
  chart_id: string;
};

type Chart = { id: string; name: string };

type Props = {
  worldId: string;
  worldSlug: string;
  entityId: string;
};

export default function EntityChartsPanel({
  worldId,
  worldSlug,
  entityId,
}: Props) {
  const [links, setLinks] = useState<ChartLink[]>([]);
  const [charts, setCharts] = useState<Chart[]>([]);
  const [picking, setPicking] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [linksRes, chartsRes] = await Promise.all([
      supabase
        .from('ra_entity_charts')
        .select('id, chart_id')
        .eq('entity_id', entityId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('ra_charts')
        .select('id, name')
        .eq('world_id', worldId)
        .order('name', { ascending: true }),
    ]);
    if (!linksRes.error) setLinks((linksRes.data as ChartLink[]) ?? []);
    if (!chartsRes.error) setCharts((chartsRes.data as Chart[]) ?? []);
  }, [worldId, entityId]);

  useEffect(() => {
    load();
  }, [load]);

  const chartById = new Map(charts.map((c) => [c.id, c]));
  const linkedIds = new Set(links.map((l) => l.chart_id));
  const addable = charts.filter((c) => !linkedIds.has(c.id));

  async function addChart() {
    if (!picking) return;
    setError(null);
    const { error } = await supabase.from('ra_entity_charts').insert({
      world_id: worldId,
      entity_id: entityId,
      chart_id: picking,
      sort_order: links.length,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setPicking('');
    load();
  }

  async function removeLink(l: ChartLink) {
    const { error } = await supabase
      .from('ra_entity_charts')
      .delete()
      .eq('id', l.id);
    if (error) setError(error.message);
    else load();
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Charts</h2>
      <p className={styles.mutedSmall}>
        Charts attached here render inline on the player view — when the
        chart itself is revealed.
      </p>
      {error && <div className={styles.error}>{error}</div>}

      {links.length === 0 ? (
        <p className={styles.mutedSmall}>No charts attached.</p>
      ) : (
        links.map((l) => {
          const c = chartById.get(l.chart_id);
          return (
            <div key={l.id} className={styles.revealRow}>
              <Link
                href={`/rpg-archive/${worldSlug}/charts/${l.chart_id}`}
                className={styles.relLink}
              >
                📊 {c?.name ?? 'Unknown chart'}
              </Link>
              <button
                className={styles.revokeBtn}
                onClick={() => removeLink(l)}
                title="Detach chart from this entity"
              >
                ✕
              </button>
            </div>
          );
        })
      )}

      {addable.length > 0 && (
        <div className={styles.revealForm}>
          <select value={picking} onChange={(e) => setPicking(e.target.value)}>
            <option value="">— attach a chart —</option>
            {addable.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            className={styles.smallRevealBtn}
            onClick={addChart}
            disabled={!picking}
          >
            Attach
          </button>
        </div>
      )}
    </section>
  );
}
