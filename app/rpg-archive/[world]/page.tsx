'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { exportWorld, downloadJson } from '../worldTransfer';
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
  player_visibility: string;
};

type Campaign = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
};

type RecentEntity = {
  id: string;
  name: string;
  slug: string;
  entity_type_id: string;
  updated_at: string;
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
  const router = useRouter();

  const [world, setWorld] = useState<World | null>(null);
  const [entityTypes, setEntityTypes] = useState<EntityType[]>([]);
  const [relTypes, setRelTypes] = useState<RelationshipType[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [recent, setRecent] = useState<RecentEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Campaign create form
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [campName, setCampName] = useState('');
  const [campDesc, setCampDesc] = useState('');
  const [campSaving, setCampSaving] = useState(false);

  // World settings
  const [showSettings, setShowSettings] = useState(false);
  const [wName, setWName] = useState('');
  const [wDesc, setWDesc] = useState('');
  const [wSystem, setWSystem] = useState('');
  const [wEdition, setWEdition] = useState('');
  const [wAccent, setWAccent] = useState('#c8900a');
  const [wVisibility, setWVisibility] = useState('hidden_by_default');
  const [wSaving, setWSaving] = useState(false);
  const [wExporting, setWExporting] = useState(false);

  async function exportThisWorld() {
    if (!world) return;
    setWExporting(true);
    setError(null);
    try {
      const bundle = await exportWorld(world.id);
      downloadJson(`${world.slug}-export.json`, bundle);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    }
    setWExporting(false);
  }

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

    const [typesRes, relsRes, campsRes, recentRes] = await Promise.all([
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
      supabase
        .from('ra_entities')
        .select('id, name, slug, entity_type_id, updated_at')
        .eq('world_id', w.id)
        .neq('status', 'deleted')
        .order('updated_at', { ascending: false })
        .limit(6),
    ]);

    if (typesRes.error) setError(typesRes.error.message);
    else setEntityTypes((typesRes.data as EntityType[]) ?? []);

    if (relsRes.error) setError(relsRes.error.message);
    else setRelTypes((relsRes.data as RelationshipType[]) ?? []);

    if (campsRes.error) setError(campsRes.error.message);
    else setCampaigns((campsRes.data as Campaign[]) ?? []);

    if (!recentRes.error) {
      setRecent((recentRes.data as RecentEntity[]) ?? []);
    }

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

  function openSettings() {
    if (!world) return;
    setWName(world.name);
    setWDesc(world.description ?? '');
    setWSystem(world.ruleset?.system ?? '');
    setWEdition(world.ruleset?.edition ?? '');
    setWAccent(world.appearance?.accent ?? '#c8900a');
    setWVisibility(world.player_visibility ?? 'hidden_by_default');
    setError(null);
    setShowSettings(true);
  }

  async function saveWorld() {
    if (!world) return;
    if (!wName.trim()) {
      setError('World name is required.');
      return;
    }
    setWSaving(true);
    setError(null);
    const ruleset: Record<string, string> = {};
    if (wSystem.trim()) ruleset.system = wSystem.trim();
    if (wEdition.trim()) ruleset.edition = wEdition.trim();
    const { error } = await supabase
      .from('ra_worlds')
      .update({
        name: wName.trim(),
        description: wDesc.trim() || null,
        ruleset,
        appearance: { ...world.appearance, accent: wAccent },
        player_visibility: wVisibility,
        updated_at: new Date().toISOString(),
      })
      .eq('id', world.id);
    setWSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setShowSettings(false);
    loadAll();
  }

  async function deleteWorld() {
    if (!world) return;
    const typed = window.prompt(
      `This permanently deletes "${world.name}" — its configuration, archive, relationships, assets, and campaigns. This cannot be undone.\n\nType the world name to confirm:`
    );
    if (typed === null) return;
    if (typed !== world.name) {
      setError('Name did not match. Nothing was deleted.');
      return;
    }
    setWSaving(true);
    setError(null);

    // Best-effort cleanup of R2 files before the rows cascade away.
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const { data: assetRows } = await supabase
      .from('ra_assets')
      .select('file_key')
      .eq('world_id', world.id);
    for (const row of assetRows ?? []) {
      try {
        await fetch('/api/rpg-archive/upload', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token ?? ''}`,
          },
          body: JSON.stringify({ key: row.file_key }),
        });
      } catch {
        // Row deletion proceeds regardless.
      }
    }

    const { error } = await supabase
      .from('ra_worlds')
      .delete()
      .eq('id', world.id);
    setWSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push('/rpg-archive');
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
          <Link
            href={`/rpg-archive/${world.slug}/search`}
            className={styles.secondaryBtn}
          >
            Search
          </Link>
          <Link
            href={`/rpg-archive/${world.slug}/graph`}
            className={styles.secondaryBtn}
          >
            Graph
          </Link>
          <Link
            href={`/rpg-archive/${world.slug}/timeline`}
            className={styles.secondaryBtn}
          >
            Timeline
          </Link>
          <Link
            href={`/rpg-archive/${world.slug}/members`}
            className={styles.secondaryBtn}
          >
            Members
          </Link>
          <button className={styles.secondaryBtn} onClick={openSettings}>
            Settings
          </button>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      {showSettings && (
        <section className={styles.editor}>
          <h3 className={styles.editorTitle}>World Settings</h3>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Name</span>
              <input
                type="text"
                value={wName}
                onChange={(e) => setWName(e.target.value)}
                autoFocus
              />
            </label>
            <label className={styles.field}>
              <span>Game System</span>
              <input
                type="text"
                value={wSystem}
                onChange={(e) => setWSystem(e.target.value)}
                placeholder="Custom Homebrew"
              />
            </label>
            <label className={styles.field}>
              <span>Edition</span>
              <input
                type="text"
                value={wEdition}
                onChange={(e) => setWEdition(e.target.value)}
                placeholder="1st Edition"
              />
            </label>
            <label className={styles.field}>
              <span>Accent Color</span>
              <input
                type="color"
                value={wAccent}
                onChange={(e) => setWAccent(e.target.value)}
                className={styles.colorInput}
              />
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span>Description</span>
              <input
                type="text"
                value={wDesc}
                onChange={(e) => setWDesc(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Player Visibility</span>
              <select
                value={wVisibility}
                onChange={(e) => setWVisibility(e.target.value)}
                className={styles.visSelect}
              >
                <option value="hidden_by_default">
                  Hidden by default (reveal piece by piece)
                </option>
                <option value="visible_by_default">
                  Visible by default (hide exceptions)
                </option>
                <option value="gm_only">GM only (players see nothing)</option>
              </select>
            </label>
          </div>
          <p className={styles.muted} style={{ marginTop: '0.75rem' }}>
            The URL slug (/{world.slug}) stays fixed so links never break.
          </p>
          <div className={styles.editorActions}>
            <button
              className={styles.dangerBtn}
              onClick={deleteWorld}
              disabled={wSaving}
            >
              Delete World
            </button>
            <button
              className={styles.secondaryBtn}
              onClick={exportThisWorld}
              disabled={wExporting}
            >
              {wExporting ? 'Exporting…' : 'Export World (JSON)'}
            </button>
            <div className={styles.editorActionsRight}>
              <button
                className={styles.secondaryBtn}
                onClick={() => setShowSettings(false)}
              >
                Cancel
              </button>
              <button
                className={styles.primaryBtn}
                onClick={saveWorld}
                disabled={wSaving}
              >
                {wSaving ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Continue Working</h2>
          <div className={styles.recentRow}>
            {recent.map((e) => {
              const t = entityTypes.find(
                (et) => et.id === e.entity_type_id
              );
              return (
                <Link
                  key={e.id}
                  href={`/rpg-archive/${world.slug}/archive/${e.slug}`}
                  className={styles.recentCard}
                >
                  <span className={styles.recentIcon}>{t?.icon || '◆'}</span>
                  <span className={styles.recentName}>{e.name}</span>
                  <span className={styles.recentMeta}>
                    {new Date(e.updated_at).toLocaleDateString('sv-SE')}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

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
            entityTypes={entityTypes}
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
