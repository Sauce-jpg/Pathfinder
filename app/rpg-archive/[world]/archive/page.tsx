'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from './archive.module.css';
import TreeView from '../../TreeView';
import { EntityType } from '../EntityTypeEditor';

type World = {
  id: string;
  name: string;
  slug: string;
  appearance: { accent?: string };
};

type EntityRow = {
  id: string;
  entity_type_id: string;
  name: string;
  slug: string;
  status: string;
  subtype: string | null;
  updated_at: string;
  tags: string[] | null;
};

type RelTypeLite = { id: string; display_name: string };

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function ArchivePage() {
  const params = useParams<{ world: string }>();
  const worldSlug = params.world;
  const router = useRouter();

  const [world, setWorld] = useState<World | null>(null);
  const [entityTypes, setEntityTypes] = useState<EntityType[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [subtypeFilter, setSubtypeFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [newTypeId, setNewTypeId] = useState('');
  const [typePickerQuery, setTypePickerQuery] = useState('');
  const [typeSearch, setTypeSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [mode, setMode] = useState<'grid' | 'tree'>('grid');
  const [relTypes, setRelTypes] = useState<RelTypeLite[]>([]);
  const [treeTypeId, setTreeTypeId] = useState('');
  const [treeEdges, setTreeEdges] = useState<
    { source_id: string; target_id: string }[]
  >([]);
  const [flip, setFlip] = useState(false);
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

    const [typesRes, entsRes, relTypesRes] = await Promise.all([
      supabase
        .from('ra_entity_types')
        .select('*')
        .eq('world_id', w.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('ra_entities')
        .select('id, entity_type_id, name, slug, status, subtype, updated_at, tags')
        .eq('world_id', w.id)
        .order('name', { ascending: true }),
      supabase
        .from('ra_relationship_types')
        .select('id, display_name')
        .eq('world_id', w.id)
        .order('display_name', { ascending: true }),
    ]);

    if (!relTypesRes.error)
      setRelTypes((relTypesRes.data as RelTypeLite[]) ?? []);

    if (typesRes.error) setError(typesRes.error.message);
    else setEntityTypes((typesRes.data as EntityType[]) ?? []);

    if (entsRes.error) setError(entsRes.error.message);
    else setEntities((entsRes.data as EntityRow[]) ?? []);

    setLoading(false);
  }, [worldSlug]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!world || !treeTypeId) {
      setTreeEdges([]);
      return;
    }
    supabase
      .from('ra_relationships')
      .select('source_id, target_id')
      .eq('world_id', world.id)
      .eq('relationship_type_id', treeTypeId)
      .then(({ data }) => {
        setTreeEdges(
          (data as { source_id: string; target_id: string }[]) ?? []
        );
      });
  }, [world, treeTypeId]);

  const accent = world?.appearance?.accent || '#c8900a';

  const typeById = new Map(entityTypes.map((t) => [t.id, t]));
  const typesAlpha = [...entityTypes].sort((a, b) =>
    a.display_name.localeCompare(b.display_name)
  );

  const live = entities.filter((e) => e.status !== 'deleted');
  const binCount = entities.length - live.length;

  const visible = live.filter((e) => {
    if (typeFilter && e.entity_type_id !== typeFilter) return false;
    if (subtypeFilter && e.subtype !== subtypeFilter) return false;
    if (
      search &&
      !e.name.toLowerCase().includes(search.toLowerCase()) &&
      !(e.tags ?? []).some((tag) =>
        tag.toLowerCase().includes(search.toLowerCase())
      )
    )
      return false;
    if (tagFilter && !(e.tags ?? []).includes(tagFilter)) return false;
    return true;
  });

  async function createEntity() {
    if (!newTypeId || !newName.trim()) {
      setError('Pick an entity type and enter a name.');
      return;
    }
    if (!world) return;
    setSaving(true);
    setError(null);

    const slug = slugify(newName);
    const { error } = await supabase.from('ra_entities').insert({
      world_id: world.id,
      entity_type_id: newTypeId,
      name: newName.trim(),
      slug,
      status: 'draft',
    });
    setSaving(false);

    if (error) {
      setError(
        error.code === '23505'
          ? `An entity with the slug "${slug}" already exists in this world.`
          : error.message
      );
      return;
    }
    router.push(`/rpg-archive/${worldSlug}/archive/${slug}`);
  }

  if (loading) {
    return (
      <div className={styles.wrap}>
        <p className={styles.muted}>Loading archive…</p>
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
          <h1 className={styles.title}>Archive</h1>
          <p className={styles.subtitle}>
            The permanent knowledge of {world.name}.
          </p>
        </div>
        <button
          className={styles.primaryBtn}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? 'Cancel' : '+ New Entity'}
        </button>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      {showForm && (
        <section className={styles.formCard}>
          <div className={styles.createRow}>
            <label className={styles.dynField}>
              <span>Entity Type</span>
              {newTypeId ? (
                <button
                  type="button"
                  className={`${styles.pill} ${styles.pillActive}`}
                  onClick={() => setNewTypeId('')}
                  title="Change type"
                >
                  {typeById.get(newTypeId)?.icon
                    ? `${typeById.get(newTypeId)?.icon} `
                    : ''}
                  {typeById.get(newTypeId)?.display_name} ✕
                </button>
              ) : (
                <>
                  <input
                    type="text"
                    value={typePickerQuery}
                    onChange={(e) => setTypePickerQuery(e.target.value)}
                    placeholder="Search types…"
                    autoFocus
                  />
                  <div className={styles.typePickerList}>
                    {typesAlpha
                      .filter((t) => t.enabled)
                      .filter((t) =>
                        t.display_name
                          .toLowerCase()
                          .includes(typePickerQuery.toLowerCase())
                      )
                      .map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className={styles.pill}
                          onClick={() => {
                            setNewTypeId(t.id);
                            setTypePickerQuery('');
                          }}
                        >
                          {t.icon ? `${t.icon} ` : ''}
                          {t.display_name}
                        </button>
                      ))}
                  </div>
                </>
              )}
            </label>
            <label className={styles.dynField}>
              <span>Name</span>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Sunny"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createEntity();
                }}
              />
            </label>
            <button
              className={styles.primaryBtn}
              onClick={createEntity}
              disabled={saving}
            >
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </section>
      )}

      <div className={styles.toolbar}>
        <div className={styles.pillRow}>
          <button
            className={`${styles.pill} ${
              typeFilter === null ? styles.pillActive : ''
            }`}
            onClick={() => {
              setTypeFilter(null);
              setSubtypeFilter(null);
            }}
          >
            All ({live.length})
          </button>
          {typesAlpha
            .filter(
              (t) =>
                !typeSearch ||
                t.display_name
                  .toLowerCase()
                  .includes(typeSearch.toLowerCase()) ||
                typeFilter === t.id
            )
            .map((t) => {
            const count = live.filter(
              (e) => e.entity_type_id === t.id
            ).length;
            return (
              <button
                key={t.id}
                className={`${styles.pill} ${
                  typeFilter === t.id ? styles.pillActive : ''
                }`}
                onClick={() => {
                  setSubtypeFilter(null);
                  setTypeFilter(typeFilter === t.id ? null : t.id);
                }}
              >
                {t.icon ? `${t.icon} ` : ''}
                {t.display_name} ({count})
              </button>
            );
          })}
          {entityTypes.length > 8 && (
            <input
              type="search"
              className={styles.typeSearchInput}
              placeholder="Filter types…"
              value={typeSearch}
              onChange={(e) => setTypeSearch(e.target.value)}
            />
          )}
          {tagFilter && (
            <button
              className={`${styles.pill} ${styles.pillActive}`}
              onClick={() => setTagFilter(null)}
              title="Clear tag filter"
            >
              #{tagFilter} ✕
            </button>
          )}
          <Link
            href={`/rpg-archive/${worldSlug}/recycle`}
            className={styles.pill}
          >
            🗑 Bin ({binCount})
          </Link>
          <Link
            href={`/rpg-archive/${worldSlug}/health`}
            className={styles.pill}
          >
            ♥ Health
          </Link>
          <button
            className={`${styles.pill} ${
              mode === 'tree' ? styles.pillActive : ''
            }`}
            onClick={() => setMode(mode === 'tree' ? 'grid' : 'tree')}
          >
            🌳 Tree
          </button>
        </div>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {typeFilter &&
        (() => {
          const st = entityTypes.find((t) => t.id === typeFilter);
          if (!st || !st.subtypes || st.subtypes.length === 0) return null;
          return (
            <div
              className={styles.pillRow}
              style={{ marginBottom: '1.25rem' }}
            >
              <button
                className={`${styles.pill} ${
                  subtypeFilter === null ? styles.pillActive : ''
                }`}
                onClick={() => setSubtypeFilter(null)}
              >
                All ({live.filter((e) => e.entity_type_id === typeFilter).length})
              </button>
              {st.subtypes.map((s) => {
                const count = live.filter(
                  (e) => e.entity_type_id === typeFilter && e.subtype === s
                ).length;
                return (
                  <button
                    key={s}
                    className={`${styles.pill} ${
                      subtypeFilter === s ? styles.pillActive : ''
                    }`}
                    onClick={() =>
                      setSubtypeFilter(subtypeFilter === s ? null : s)
                    }
                  >
                    {s} ({count})
                  </button>
                );
              })}
            </div>
          );
        })()}

      {mode === 'tree' ? (
        <>
          <div className={styles.treeControls}>
            <select
              value={treeTypeId}
              onChange={(e) => setTreeTypeId(e.target.value)}
            >
              <option value="">— relationship type —</option>
              {relTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.display_name}
                </option>
              ))}
            </select>
            <button
              className={styles.pill}
              onClick={() => setFlip((f) => !f)}
              title="Swap which side of the relationship is the parent"
            >
              ⇅ Flip parent/child
            </button>
          </div>
          {treeTypeId ? (
            <TreeView
              nodes={live.map((e) => {
                const t = typeById.get(e.entity_type_id);
                return {
                  id: e.id,
                  label: e.name,
                  icon: t?.icon,
                  href: `/rpg-archive/${worldSlug}/archive/${e.slug}`,
                  meta: t?.display_name,
                };
              })}
              edges={treeEdges.map((r) =>
                flip
                  ? { parent: r.source_id, child: r.target_id }
                  : { parent: r.target_id, child: r.source_id }
              )}
            />
          ) : (
            <p className={styles.muted}>
              Pick a relationship type to build the tree — e.g. Located In
              for a places hierarchy, Parent Of for a family tree.
            </p>
          )}
        </>
      ) : visible.length === 0 ? (
        <div className={styles.empty}>
          <p>
            {live.length === 0
              ? 'The Archive is empty.'
              : 'Nothing matches the current filter.'}
          </p>
          {live.length === 0 && (
            <p className={styles.muted}>
              Every person, place, and concept of {world.name} will live
              here — created once, referenced everywhere.
            </p>
          )}
        </div>
      ) : (
        <div className={styles.entityGrid}>
          {visible.map((e) => {
            const t = typeById.get(e.entity_type_id);
            return (
              <Link
                key={e.id}
                href={`/rpg-archive/${worldSlug}/archive/${e.slug}`}
                className={styles.entityCard}
                style={{ borderLeftColor: t?.color || accent }}
              >
                <span className={styles.entityIcon}>{t?.icon || '◆'}</span>
                <span className={styles.entityName}>{e.name}</span>
                <span className={styles.entityMeta}>
                  {t?.display_name ?? 'Unknown type'}
                  {e.subtype && ` · ${e.subtype}`}
                  {e.status !== 'published' && ` · ${e.status}`}
                </span>
                {(e.tags ?? []).length > 0 && (
                  <span className={styles.tagRow}>
                    {(e.tags ?? []).map((tag) => (
                      <button
                        key={tag}
                        className={`${styles.tagChip} ${
                          tagFilter === tag ? styles.tagChipActive : ''
                        }`}
                        onClick={(ev) => {
                          ev.preventDefault();
                          setTagFilter(tagFilter === tag ? null : tag);
                        }}
                        title="Filter by tag"
                      >
                        #{tag}
                      </button>
                    ))}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
