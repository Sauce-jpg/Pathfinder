'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import styles from './archive.module.css';

export type LinkedAsset = {
  id: string; // junction row id
  asset_id: string;
  role: string | null;
  sort_order: number;
  asset: {
    id: string;
    name: string;
    asset_type: string;
    url: string;
  };
};

type AssetRow = {
  id: string;
  name: string;
  asset_type: string;
  url: string;
};

const TYPE_ICONS: Record<string, string> = {
  image: '🖼️',
  document: '📄',
  audio: '🎵',
  video: '🎬',
};

type Props = {
  worldId: string;
  entityId: string;
  onLoaded?: (assets: LinkedAsset[]) => void;
};

export default function AssetPanel({ worldId, entityId, onLoaded }: Props) {
  const [linked, setLinked] = useState<LinkedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [allAssets, setAllAssets] = useState<AssetRow[]>([]);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');

  const loadLinked = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ra_entity_assets')
      .select('id, asset_id, role, sort_order, asset:ra_assets(id, name, asset_type, url)')
      .eq('entity_id', entityId)
      .order('sort_order', { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      const rows = (data as unknown as LinkedAsset[]) ?? [];
      setLinked(rows);
      onLoaded?.(rows);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  useEffect(() => {
    loadLinked();
  }, [loadLinked]);

  async function openPicker() {
    setPickerOpen(true);
    setError(null);
    const { data, error } = await supabase
      .from('ra_assets')
      .select('id, name, asset_type, url')
      .eq('world_id', worldId)
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setAllAssets((data as AssetRow[]) ?? []);
  }

  async function linkAsset(asset: AssetRow) {
    setError(null);
    const nextOrder =
      linked.length > 0 ? Math.max(...linked.map((l) => l.sort_order)) + 1 : 0;
    const { error } = await supabase.from('ra_entity_assets').insert({
      world_id: worldId,
      entity_id: entityId,
      asset_id: asset.id,
      role: role.trim() || null,
      sort_order: nextOrder,
    });
    if (error) {
      setError(
        error.code === '23505'
          ? `"${asset.name}" is already linked with that role.`
          : error.message
      );
      return;
    }
    setPickerOpen(false);
    setSearch('');
    setRole('');
    loadLinked();
  }

  async function unlink(row: LinkedAsset) {
    const { error } = await supabase
      .from('ra_entity_assets')
      .delete()
      .eq('id', row.id);
    if (error) {
      setError(error.message);
      return;
    }
    loadLinked();
  }

  const pickable = allAssets.filter(
    (a) => !search || a.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className={styles.section}>
      <div className={styles.relHeader}>
        <h2 className={styles.sectionTitle}>Assets</h2>
        <button className={styles.primaryBtn} onClick={openPicker}>
          + Link Asset
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {pickerOpen && (
        <div className={styles.assetPicker}>
          <div className={styles.assetPickerBar}>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search assets…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            <input
              type="text"
              className={styles.roleInput}
              placeholder="Role (optional): Portrait, Map…"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              list="ra-asset-roles"
            />
            <datalist id="ra-asset-roles">
              <option value="Portrait" />
              <option value="Artwork" />
              <option value="Map" />
              <option value="Handout" />
              <option value="Theme" />
            </datalist>
            <button
              className={styles.secondaryBtn}
              onClick={() => setPickerOpen(false)}
            >
              Cancel
            </button>
          </div>
          {pickable.length === 0 ? (
            <p className={styles.muted}>
              No matching assets. Upload media in the Asset Library first.
            </p>
          ) : (
            <div className={styles.assetPickerGrid}>
              {pickable.map((a) => (
                <button
                  key={a.id}
                  className={styles.assetPickCard}
                  onClick={() => linkAsset(a)}
                  title={`Link "${a.name}"`}
                >
                  <div className={styles.assetThumb}>
                    {a.asset_type === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.url} alt={a.name} loading="lazy" />
                    ) : (
                      <span>{TYPE_ICONS[a.asset_type] ?? '📦'}</span>
                    )}
                  </div>
                  <span className={styles.assetPickName}>{a.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <p className={styles.muted}>Loading assets…</p>
      ) : linked.length === 0 && !pickerOpen ? (
        <p className={styles.muted}>
          No assets linked. A portrait, a map, a theme — media lives in the
          Asset Library and is referenced from here.
        </p>
      ) : (
        <div className={styles.linkedGrid}>
          {linked.map((l) => (
            <div key={l.id} className={styles.linkedCard}>
              <a href={l.asset.url} target="_blank" rel="noreferrer">
                <div className={styles.assetThumb}>
                  {l.asset.asset_type === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.asset.url} alt={l.asset.name} loading="lazy" />
                  ) : (
                    <span>{TYPE_ICONS[l.asset.asset_type] ?? '📦'}</span>
                  )}
                </div>
              </a>
              <span className={styles.assetPickName}>{l.asset.name}</span>
              {l.role && <span className={styles.roleTag}>{l.role}</span>}
              <button
                className={styles.unlinkBtn}
                onClick={() => unlink(l)}
                title="Remove reference (the asset itself is kept)"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
