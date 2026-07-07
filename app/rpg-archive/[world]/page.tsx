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

type Campaign = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
};

function slugifyName(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function WorldPage() {
  const params = useParams<{ world: string }>();
  const worldSlug = params.world;

  const [world, setWorld] = useState<World | null>(null);
  const [entityTypes, setEntityTypes] = useState<EntityType[]>([]);
  const [relTypes, setRelTypes] = useState<RelationshipType[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Campaign create form
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [campName, setCampName] = useState('');
  const [campDesc, setCampDesc] = useState('');
  const [campSaving, setCampSaving] = useState(false);

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

    const [typesRes, relsRes, campsRes] = await Promise.all([
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
      supabase
        .from('ra_campaigns')
        .select('id, name, slug, description, status')
        .eq('world_id', w.id)
        .order('created_at', { ascending: true }),
    ]);

    if (typesRes.error) setError(typesRes.error.message);
    else setEntityTypes((typesRes.data as EntityType[]) ?? []);

    if (relsRes.error) setError(relsRes.error.message);
    else setRelTypes((relsRes.data as RelationshipType[]) ?? []);

    if (campsRes.error) setError(campsRes.error.message);
    else setCampaigns((campsRes.data as Campaign[]) ?? []);

    setLoading(false);
  }, [worldSlug]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const accent = world?.appearance?.accent || '#c8900a';

  async function createCampaign() {
    if (!world || !campName.trim()) {
      setError('Campaign name is required.');
      return;
    }
    setCampSaving(true);
    setError(null);
    const slug = slugifyName(campName);
    const { error } = await supabase.from('ra_campaigns').insert({
      world_id: world.id,
      name: campName.trim(),
      slug,
      description: campDesc.trim() || null,
    });
    setCampSaving(false);
    if (error) {
      setError(
        error.code === '23505'
          ? `A campaign with the slug "${slug}" already exists in this world.`
          : error.message
      );
      return;
    }
    setCampName('');
    setCampDesc('');
    setShowCampaignForm(false);
    loadAll();
  }

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
        <div className={styles.headerBtns}>
          <Link
            href={`/rpg-archive/${world.slug}/archive`}
            className={styles.primaryBtn}
          >
            Open Archive →
          </Link>
          <Link
            href={`/rpg-archive/${world.slug}/assets`}
            className={styles.secondaryBtn}
          >
            Asset Library
          </Link>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Campaigns</h2>
            <p className={styles.muted}>
              Playthroughs within {world.name}. They reference the Archive —
              they never own it.
            </p>
          </div>
          <button
            className={styles.primaryBtn}
            onClick={() => setShowCampaignForm((v) => !v)}
          >
            {showCampaignForm ? 'Cancel' : '+ New Campaign'}
          </button>
        </div>

        {showCampaignForm && (
          <div className={styles.editor}>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Name</span>
                <input
                  type="text"
                  value={campName}
                  onChange={(e) => setCampName(e.target.value)}
                  placeholder="The Forgotten Shore"
                  autoFocus
                />
              </label>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span>Description (optional)</span>
                <input
                  type="text"
                  value={campDesc}
                  onChange={(e) => setCampDesc(e.target.value)}
                  placeholder="Our first descent into the Dream Realm…"
                />
              </label>
            </div>
            <div className={styles.editorActions}>
              <div className={styles.editorActionsRight}>
                <button
                  className={styles.primaryBtn}
                  onClick={createCampaign}
                  disabled={campSaving}
                >
                  {campSaving ? 'Creating…' : 'Create Campaign'}
                </button>
              </div>
            </div>
          </div>
        )}

        {campaigns.length === 0 && !showCampaignForm ? (
          <div className={styles.empty}>
            <p>No campaigns yet.</p>
            <p className={styles.muted}>
              A campaign holds sessions, notes, and play history — the story
              of one journey through this world.
            </p>
          </div>
        ) : (
          <div className={styles.typeGrid}>
            {campaigns.map((c) => (
              <Link
                key={c.id}
                href={`/rpg-archive/${world.slug}/campaigns/${c.slug}`}
                className={styles.typeCard}
              >
                <span className={styles.typeName}>{c.name}</span>
                {c.description && (
                  <span className={styles.campaignDesc}>{c.description}</span>
                )}
                <span className={styles.typeMeta}>{c.status}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

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
