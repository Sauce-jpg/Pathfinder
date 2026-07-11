'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from '../../../charts/charts.module.css';
import playStyles from '../../play.module.css';
import PlayerChartTable from '../../PlayerChartTable';

type World = {
  id: string;
  name: string;
  slug: string;
  appearance: { accent?: string };
};

function PlayChartPageInner() {
  const params = useParams<{ world: string; chart: string }>();
  const { world: worldSlug, chart: chartId } = params;
  const searchParams = useSearchParams();
  const viewAs = searchParams.get('as');

  const [world, setWorld] = useState<World | null>(null);
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
    setLoading(false);
  }, [worldSlug, viewAs]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const accent = world?.appearance?.accent || '#c8900a';

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
      <Link
        href={`/rpg-archive/${worldSlug}/play${
          viewAs ? `?as=${viewAs}` : ''
        }`}
        className={styles.backLink}
      >
        ← {world.name}
      </Link>

      {viewAs && (
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
      )}

      <div style={{ marginTop: '1rem' }}>
        <PlayerChartTable
          worldId={world.id}
          worldSlug={worldSlug}
          chartId={chartId}
          viewAs={viewAs}
        />
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
