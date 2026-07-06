'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from './world.module.css';
import EntityTypeEditor, { EntityType } from './EntityTypeEditor';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // null = editor closed, 'new' = creating, EntityType = editing
  const [editing, setEditing] = useState<EntityType | 'new' | null>(null);

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

    const { data: types, error: tErr } = await supabase
      .from('ra_entity_types')
      .select('*')
      .eq('world_id', w.id)
      .order('sort_order', { ascending: true });

    if (tErr) {
      setError(tErr.message);
    } else {
      setEntityTypes((types as EntityType[]) ?? []);
    }
    setLoading(false);
  }, [worldSlug]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const accent = world?.appearance?.accent || '#c8900a';

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

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{world.name}</h1>
          {world.ruleset?.system && (
            <span className={styles.badge}>{world.ruleset.system}</span>
          )}
          {world.description && (
            <p className={styles.subtitle}>{world.description}</p>
          )}
        </div>
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
            onClick={() => setEditing('new')}
          >
            + New Entity Type
          </button>
        </div>

        {entityTypes.length === 0 && editing === null && (
          <div className={styles.empty}>
            <p>No entity types defined yet.</p>
            <p className={styles.muted}>
              Entity Types define what can exist here — Character, Location,
              Aspect, Nightmare… Define one to shape your Archive.
            </p>
          </div>
        )}

        {editing !== null && (
          <EntityTypeEditor
            worldId={world.id}
            existing={editing === 'new' ? null : editing}
            nextSortOrder={
              entityTypes.length > 0
                ? Math.max(...entityTypes.map((t) => t.sort_order)) + 1
                : 0
            }
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
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
              onClick={() => setEditing(t)}
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
        <h2 className={styles.sectionTitle}>Relationship Types</h2>
        <p className={styles.muted}>Coming in the next step.</p>
      </section>
    </div>
  );
}
