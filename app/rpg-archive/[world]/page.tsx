'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from './world.module.css';
import EntityTypeEditor, { EntityType } from './EntityTypeEditor';
import RelationshipTypeEditor, {
  RelationshipType,
} from './RelationshipTypeEditor';

type World = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ruleset: { system?: string; edition?: string };
  appearance: { accent?: string };
};

export default function WorldPage() {
  const params = useParams<{ world: string }>();
  const worldSlug = params.world;

  const [world, setWorld] = useState<World | null>(null);
  const [entityTypes, setEntityTypes] = useState<EntityType[]>([]);
  const [relTypes, setRelTypes] = useState<RelationshipType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // null = editor closed, 'new' = creating, object = editing
  const [editingEntity, setEditingEntity] = useState<EntityType | 'new' | null>(
    null
  );
  const [editingRel, setEditingRel] = useState<
    RelationshipType | 'new' | null
  >(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: w, error: wErr } = await supabase
      .from('ra_worlds')
      .select('*')
      .eq('slug', worldSlug)
      .single();

    if (wErr || !w) {
      setError(wErr?.message ?? 'World not found.');
      setLoading(false);
      return;
    }
    setWorld(w as World);

    const [typesRes, relsRes] = await Promise.all([
      supabase
        .from('ra_entity_types')
        .select('*')
        .eq('world_id', w.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('ra_relationship_types')
        .select('*')
        .eq('world_id', w.id)
        .order('display_name', { ascending: true }),
    ]);

    if (typesRes.error) setError(typesRes.error.message);
    else setEntityTypes((typesRes.data as EntityType[]) ?? []);

    if (relsRes.error) setError(relsRes.error.message);
    else setRelTypes((relsRes.data as RelationshipType[]) ?? []);

    setLoading(false);
  }, [worldSlug]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const accent = world?.appearance?.accent || '#c8900a';

  function typeNames(ids: string[]): string {
    if (!ids || ids.length === 0) return 'Any';
    return ids
      .map(
        (id) => entityTypes.find((t) => t.id === id)?.display_name ?? '?'
      )
      .join(', ');
  }

  if (loading) {
    return (
      <div className={styles.wrap}>
        <p className={styles.muted}>Loading world…</p>
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
      <Link href="/rpg-archive" className={styles.backLink}>
        ← All Worlds
      </Link>

      <header className={`${styles.header} ${styles.headerRow}`}>
        <div>
          <h1 className={styles.title}>{world.name}</h1>
          {world.ruleset?.system && (
            <span className={styles.badge}>{world.ruleset.system}</span>
          )}
          {world.description && (
            <p className={styles.subtitle}>{world.description}</p>
          )}
        </div>
        <Link
          href={`/rpg-archive/${world.slug}/archive`}
          className={styles.primaryBtn}
        >
          Open Archive →
        </Link>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Entity Types</h2>
            <p className={styles.muted}>
              The categories of knowledge this world contains — and the
              structured fields each one carries.
            </p>
          </div>
          <button
            className={styles.primaryBtn}
            onClick={() => setEditingEntity('new')}
          >
            + New Entity Type
          </button>
        </div>

        {entityTypes.length === 0 && editingEntity === null && (
          <div className={styles.empty}>
            <p>No entity types defined yet.</p>
            <p className={styles.muted}>
              Entity Types define what can exist here — Character, Location,
              Aspect, Nightmare… Define one to shape your Archive.
            </p>
          </div>
        )}

        {editingEntity !== null && (
          <EntityTypeEditor
            worldId={world.id}
            existing={editingEntity === 'new' ? null : editingEntity}
            nextSortOrder={
              entityTypes.length > 0
                ? Math.max(...entityTypes.map((t) => t.sort_order)) + 1
                : 0
            }
            onClose={() => setEditingEntity(null)}
            onSaved={() => {
              setEditingEntity(null);
              loadAll();
            }}
          />
        )}

        <div className={styles.typeGrid}>
          {entityTypes.map((t) => (
            <button
              key={t.id}
              className={styles.typeCard}
              style={{ borderLeftColor: t.color || accent }}
              onClick={() => setEditingEntity(t)}
            >
              <span className={styles.typeIcon}>{t.icon || '◆'}</span>
              <span className={styles.typeName}>{t.display_name}</span>
              <span className={styles.typeMeta}>
                {t.fields.length} field{t.fields.length === 1 ? '' : 's'}
                {!t.enabled && ' · disabled'}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Relationship Types</h2>
            <p className={styles.muted}>
              The vocabulary used to connect knowledge — Member Of, Located
              In, Corrupted By…
            </p>
          </div>
          <button
            className={styles.primaryBtn}
            onClick={() => setEditingRel('new')}
          >
            + New Relationship Type
          </button>
        </div>

        {relTypes.length === 0 && editingRel === null && (
          <div className={styles.empty}>
            <p>No relationship types defined yet.</p>
            <p className={styles.muted}>
              Relationships are first-class knowledge. Define the vocabulary
              here; connect entities with it later.
            </p>
          </div>
        )}

        {editingRel !== null && (
          <RelationshipTypeEditor
            worldId={world.id}
            entityTypes={entityTypes}
            existing={editingRel === 'new' ? null : editingRel}
            onClose={() => setEditingRel(null)}
            onSaved={() => {
              setEditingRel(null);
              loadAll();
            }}
          />
        )}

        <div className={styles.typeGrid}>
          {relTypes.map((r) => (
            <button
              key={r.id}
              className={styles.typeCard}
              style={{ borderLeftColor: r.color || accent }}
              onClick={() => setEditingRel(r)}
            >
              <span className={styles.typeName}>
                {r.display_name}
                {r.inverse_name && (
                  <span className={styles.inverseName}>
                    {' '}
                    ⇄ {r.inverse_name}
                  </span>
                )}
              </span>
              <span className={styles.typeMeta}>
                {typeNames(r.allowed_source_types)} →{' '}
                {typeNames(r.allowed_target_types)}
              </span>
              <span className={styles.typeMeta}>
                {r.metadata_schema.length} propert
                {r.metadata_schema.length === 1 ? 'y' : 'ies'}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
