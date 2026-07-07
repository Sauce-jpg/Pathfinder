'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from './recycle.module.css';

type World = {
  id: string;
  name: string;
  slug: string;
  appearance: { accent?: string };
};

type EntityTypeRow = {
  id: string;
  display_name: string;
  icon: string | null;
  color: string | null;
};

type BinnedEntity = {
  id: string;
  entity_type_id: string;
  name: string;
  slug: string;
  updated_at: string;
};

export default function RecycleBinPage() {
  const params = useParams<{ world: string }>();
  const worldSlug = params.world;

  const [world, setWorld] = useState<World | null>(null);
  const [types, setTypes] = useState<EntityTypeRow[]>([]);
  const [entities, setEntities] = useState<BinnedEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
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
      setError(wErr?.message ?? 'World not found.');
      setLoading(false);
      return;
    }
    setWorld(w as World);

    const [typesRes, entsRes] = await Promise.all([
      supabase
        .from('ra_entity_types')
        .select('id, display_name, icon, color')
        .eq('world_id', w.id),
      supabase
        .from('ra_entities')
        .select('id, entity_type_id, name, slug, updated_at')
        .eq('world_id', w.id)
        .eq('status', 'deleted')
        .order('updated_at', { ascending: false }),
    ]);

    if (typesRes.error) setError(typesRes.error.message);
    else setTypes((typesRes.data as EntityTypeRow[]) ?? []);

    if (entsRes.error) setError(entsRes.error.message);
    else setEntities((entsRes.data as BinnedEntity[]) ?? []);

    setLoading(false);
  }, [worldSlug]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const accent = world?.appearance?.accent || '#c8900a';
  const typeById = new Map(types.map((t) => [t.id, t]));

  async function restore(e: BinnedEntity) {
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from('ra_entities')
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', e.id);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    loadAll();
  }

  async function deleteForever(e: BinnedEntity) {
    const { count } = await supabase
      .from('ra_relationships')
      .select('id', { count: 'exact', head: true })
      .or(`source_id.eq.${e.id},target_id.eq.${e.id}`);
    const relNote =
      count && count > 0
        ? ` This will also remove ${count} relationship${
            count === 1 ? '' : 's'
          }.`
        : '';
    const ok = window.confirm(
      `Permanently delete "${e.name}"?${relNote} This cannot be undone.`
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from('ra_entities')
      .delete()
      .eq('id', e.id);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    loadAll();
  }

  if (loading) {
    return (
      <div className={styles.wrap}>
        <p className={styles.muted}>Loading recycle bin…</p>
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
      <Link
        href={`/rpg-archive/${worldSlug}/archive`}
        className={styles.backLink}
      >
        ← Archive
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>Recycle Bin</h1>
        <p className={styles.subtitle}>
          Deleted entities from {world.name}. Restoring brings back the
          entity with all its relationships, assets, and appearances intact.
        </p>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      {entities.length === 0 ? (
        <div className={styles.empty}>
          <p>The bin is empty.</p>
          <p className={styles.muted}>
            Entities you delete land here first, and can be restored or
            removed permanently.
          </p>
        </div>
      ) : (
        <div className={styles.list}>
          {entities.map((e) => {
            const t = typeById.get(e.entity_type_id);
            return (
              <div key={e.id} className={styles.row}>
                <span className={styles.rowIcon}>{t?.icon || '◆'}</span>
                <span className={styles.rowName}>{e.name}</span>
                <span className={styles.rowMeta}>
                  {t?.display_name ?? 'Unknown type'} · deleted{' '}
                  {new Date(e.updated_at).toLocaleDateString('sv-SE')}
                </span>
                <div className={styles.rowActions}>
                  <button
                    className={styles.secondaryBtn}
                    onClick={() => restore(e)}
                    disabled={busy}
                  >
                    Restore
                  </button>
                  <button
                    className={styles.dangerBtn}
                    onClick={() => deleteForever(e)}
                    disabled={busy}
                  >
                    Delete Forever
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
