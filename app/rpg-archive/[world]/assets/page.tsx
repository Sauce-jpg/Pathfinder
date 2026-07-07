'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from './assets.module.css';

type World = {
  id: string;
  name: string;
  slug: string;
  appearance: { accent?: string };
};

type Asset = {
  id: string;
  name: string;
  asset_type: string;
  file_key: string;
  url: string;
  mime_type: string | null;
  size_bytes: number | null;
  description: string | null;
  created_at: string;
};

const TYPE_ICONS: Record<string, string> = {
  image: '🖼️',
  document: '📄',
  audio: '🎵',
  video: '🎬',
};

function inferType(mime: string): string {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return 'document';
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AssetLibraryPage() {
  const params = useParams<{ world: string }>();
  const worldSlug = params.world;

  const [world, setWorld] = useState<World | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);

  const [selected, setSelected] = useState<Asset | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      .from('ra_assets')
      .select('*')
      .eq('world_id', w.id)
      .order('created_at', { ascending: false });

    if (error) setError(error.message);
    else setAssets((data as Asset[]) ?? []);
    setLoading(false);
  }, [worldSlug]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const accent = world?.appearance?.accent || '#c8900a';

  const visible = assets.filter((a) => {
    if (typeFilter && a.asset_type !== typeFilter) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !world) return;
    setError(null);

    for (const file of Array.from(files)) {
      setUploading(file.name);
      try {
        const res = await fetch('/api/rpg-archive/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || 'application/octet-stream',
          }),
        });
        if (!res.ok) throw new Error('Could not get upload URL.');
        const { uploadUrl, key, publicUrl } = await res.json();

        const put = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
        });
        if (!put.ok) throw new Error(`Upload failed for ${file.name}.`);

        const { error: insErr } = await supabase.from('ra_assets').insert({
          world_id: world.id,
          name: file.name.replace(/\.[^.]+$/, ''),
          asset_type: inferType(file.type),
          file_key: key,
          url: publicUrl,
          mime_type: file.type || null,
          size_bytes: file.size,
        });
        if (insErr) throw new Error(insErr.message);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed.');
        break;
      }
    }

    setUploading(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    loadAll();
  }

  function openAsset(a: Asset) {
    setSelected(a);
    setEditName(a.name);
    setEditDesc(a.description ?? '');
    setError(null);
  }

  async function saveAsset() {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase
      .from('ra_assets')
      .update({
        name: editName.trim() || selected.name,
        description: editDesc.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selected.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSelected(null);
    loadAll();
  }

  async function deleteAsset() {
    if (!selected) return;
    const ok = window.confirm(
      `Delete "${selected.name}"? The file will be removed from storage. This cannot be undone.`
    );
    if (!ok) return;
    setSaving(true);

    // Remove the file from R2 first, then the row (explicit cleanup).
    try {
      await fetch('/api/rpg-archive/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: selected.file_key }),
      });
    } catch {
      // Row deletion proceeds; an orphaned file is preferable to a broken row.
    }

    const { error } = await supabase
      .from('ra_assets')
      .delete()
      .eq('id', selected.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSelected(null);
    loadAll();
  }

  if (loading) {
    return (
      <div className={styles.wrap}>
        <p className={styles.muted}>Loading asset library…</p>
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
          <h1 className={styles.title}>Asset Library</h1>
          <p className={styles.subtitle}>
            Reusable media for {world.name} — uploaded once, referenced
            everywhere.
          </p>
        </div>
        <button
          className={styles.primaryBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={!!uploading}
        >
          {uploading ? `Uploading ${uploading}…` : '+ Upload'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </header>

      {error && <div className={styles.error}>{error}</div>}

      {selected && (
        <section className={styles.editCard}>
          <div className={styles.editPreview}>
            {selected.asset_type === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.url} alt={selected.name} />
            ) : (
              <span className={styles.bigIcon}>
                {TYPE_ICONS[selected.asset_type] ?? '📦'}
              </span>
            )}
          </div>
          <div className={styles.editFields}>
            <label className={styles.field}>
              <span>Name</span>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Description</span>
              <textarea
                rows={2}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
            </label>
            <p className={styles.mutedSmall}>
              {selected.mime_type} · {formatSize(selected.size_bytes)} ·{' '}
              <a href={selected.url} target="_blank" rel="noreferrer">
                open file
              </a>
            </p>
            <div className={styles.editActions}>
              <button
                className={styles.dangerBtn}
                onClick={deleteAsset}
                disabled={saving}
              >
                Delete
              </button>
              <div className={styles.editActionsRight}>
                <button
                  className={styles.secondaryBtn}
                  onClick={() => setSelected(null)}
                >
                  Cancel
                </button>
                <button
                  className={styles.primaryBtn}
                  onClick={saveAsset}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className={styles.toolbar}>
        <div className={styles.pillRow}>
          <button
            className={`${styles.pill} ${
              typeFilter === null ? styles.pillActive : ''
            }`}
            onClick={() => setTypeFilter(null)}
          >
            All ({assets.length})
          </button>
          {['image', 'document', 'audio', 'video'].map((t) => {
            const count = assets.filter((a) => a.asset_type === t).length;
            if (count === 0) return null;
            return (
              <button
                key={t}
                className={`${styles.pill} ${
                  typeFilter === t ? styles.pillActive : ''
                }`}
                onClick={() => setTypeFilter(typeFilter === t ? null : t)}
              >
                {TYPE_ICONS[t]} {t} ({count})
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

      {visible.length === 0 ? (
        <div className={styles.empty}>
          <p>
            {assets.length === 0
              ? 'No assets yet.'
              : 'Nothing matches the current filter.'}
          </p>
          {assets.length === 0 && (
            <p className={styles.muted}>
              Portraits, maps, handouts, theme music — upload them here and
              reference them from any entity.
            </p>
          )}
        </div>
      ) : (
        <div className={styles.assetGrid}>
          {visible.map((a) => (
            <button
              key={a.id}
              className={styles.assetCard}
              onClick={() => openAsset(a)}
            >
              <div className={styles.thumb}>
                {a.asset_type === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={a.name} loading="lazy" />
                ) : (
                  <span className={styles.thumbIcon}>
                    {TYPE_ICONS[a.asset_type] ?? '📦'}
                  </span>
                )}
              </div>
              <span className={styles.assetName}>{a.name}</span>
              <span className={styles.assetMeta}>
                {a.asset_type} · {formatSize(a.size_bytes)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
