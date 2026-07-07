'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from '../archive.module.css';
import DynamicFields, { EntityOption } from '../DynamicFields';
import RelationshipPanel from '../RelationshipPanel';
import AssetPanel, { LinkedAsset } from '../AssetPanel';
import AppearancesPanel from '../AppearancesPanel';
import MarkdownEditor from '../../../MarkdownEditor';
import { EntityType } from '../../EntityTypeEditor';

type World = {
  id: string;
  name: string;
  slug: string;
  appearance: { accent?: string };
};

type Entity = {
  id: string;
  world_id: string;
  entity_type_id: string;
  name: string;
  slug: string;
  data: Record<string, unknown>;
  doc: string;
  status: string;
  updated_at: string;
};

const STATUSES = ['draft', 'published', 'archived'];

export default function EntityPage() {
  const params = useParams<{ world: string; entity: string }>();
  const { world: worldSlug, entity: entitySlug } = params;
  const router = useRouter();

  const [world, setWorld] = useState<World | null>(null);
  const [entity, setEntity] = useState<Entity | null>(null);
  const [entityType, setEntityType] = useState<EntityType | null>(null);
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable state
  const [name, setName] = useState('');
  const [status, setStatus] = useState('draft');
  const [data, setData] = useState<Record<string, unknown>>({});
  const [doc, setDoc] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [linkedAssets, setLinkedAssets] = useState<LinkedAsset[]>([]);

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

    const { data: ent, error: eErr } = await supabase
      .from('ra_entities')
      .select('*')
      .eq('world_id', w.id)
      .eq('slug', entitySlug)
      .single();

    if (eErr || !ent) {
      setError(eErr?.message ?? 'Entity not found.');
      setLoading(false);
      return;
    }
    const e = ent as Entity;
    setEntity(e);
    setName(e.name);
    setStatus(e.status);
    setData(e.data ?? {});
    setDoc(e.doc ?? '');

    const [typeRes, optsRes] = await Promise.all([
      supabase
        .from('ra_entity_types')
        .select('*')
        .eq('id', e.entity_type_id)
        .single(),
      supabase
        .from('ra_entities')
        .select('id, name')
        .eq('world_id', w.id)
        .neq('id', e.id)
        .order('name', { ascending: true }),
    ]);

    if (typeRes.error) setError(typeRes.error.message);
    else setEntityType(typeRes.data as EntityType);

    if (!optsRes.error) {
      setEntityOptions((optsRes.data as EntityOption[]) ?? []);
    }

    setLoading(false);
  }, [worldSlug, entitySlug]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const accent = world?.appearance?.accent || '#c8900a';

  function missingRequired(): string[] {
    if (!entityType) return [];
    return entityType.fields
      .filter((f) => {
        if (!f.required) return false;
        const v = data[f.key];
        if (v === undefined || v === null || v === '') return true;
        if (Array.isArray(v) && v.length === 0) return true;
        return false;
      })
      .map((f) => f.label);
  }

  async function save() {
    if (!entity) return;
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    // Drafts may be incomplete; anything else must satisfy required fields.
    if (status !== 'draft') {
      const missing = missingRequired();
      if (missing.length > 0) {
        setError(
          `Required fields missing for status "${status}": ${missing.join(
            ', '
          )}. Save as draft, or fill them in.`
        );
        return;
      }
    }

    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from('ra_entities')
      .update({
        name: name.trim(),
        status,
        data,
        doc,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entity.id);
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }
    setSavedAt(new Date().toLocaleTimeString('sv-SE'));
  }

  async function deleteEntity() {
    if (!entity) return;
    const { count } = await supabase
      .from('ra_relationships')
      .select('id', { count: 'exact', head: true })
      .or(`source_id.eq.${entity.id},target_id.eq.${entity.id}`);
    const relNote =
      count && count > 0
        ? ` This will also remove ${count} relationship${
            count === 1 ? '' : 's'
          }.`
        : '';
    const ok = window.confirm(
      `Delete "${entity.name}"?${relNote} This cannot be undone.`
    );
    if (!ok) return;
    setSaving(true);
    const { error } = await supabase
      .from('ra_entities')
      .delete()
      .eq('id', entity.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(`/rpg-archive/${worldSlug}/archive`);
  }

  if (loading) {
    return (
      <div className={styles.wrap}>
        <p className={styles.muted}>Loading entity…</p>
      </div>
    );
  }

  if (!world || !entity || !entityType) {
    return (
      <div className={styles.wrap}>
        <div className={styles.error}>{error ?? 'Entity not found.'}</div>
        <Link
          href={`/rpg-archive/${worldSlug}/archive`}
          className={styles.backLink}
        >
          ← Archive
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
        {(() => {
          const portrait =
            linkedAssets.find(
              (l) =>
                l.asset.asset_type === 'image' &&
                l.role?.toLowerCase() === 'portrait'
            ) ?? linkedAssets.find((l) => l.asset.asset_type === 'image');
          return portrait ? (
            <div className={styles.portrait}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={portrait.asset.url} alt={name} />
            </div>
          ) : null;
        })()}
        <div className={styles.entityHeader}>
          <span
            className={styles.entityTypeBadge}
            style={{ color: entityType.color || accent }}
          >
            {entityType.icon ? `${entityType.icon} ` : ''}
            {entityType.display_name}
          </span>
          <input
            type="text"
            className={styles.nameInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <span className={styles.mutedSmall}>/{entity.slug}</span>
        </div>
        <div className={styles.headerActions}>
          <select
            className={styles.statusSelect}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            className={styles.primaryBtn}
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}
      {savedAt && !error && (
        <p className={styles.mutedSmall}>Saved at {savedAt}.</p>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Structured Data</h2>
        <DynamicFields
          fields={entityType.fields}
          data={data}
          onChange={(key, value) =>
            setData((prev) => ({ ...prev, [key]: value }))
          }
          entityOptions={entityOptions}
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Documentation</h2>
        <p className={styles.mutedSmall}>
          Markdown — history, appearance, personality, tactics, trivia…
        </p>
        <MarkdownEditor
          value={doc}
          onChange={setDoc}
          rows={16}
          placeholder={`## History\n\n## Appearance\n\n## Notes`}
        />
      </section>

      <RelationshipPanel
        worldSlug={worldSlug}
        worldId={world.id}
        entityId={entity.id}
        entityTypeId={entity.entity_type_id}
      />

      <AssetPanel
        worldId={world.id}
        entityId={entity.id}
        onLoaded={setLinkedAssets}
      />

      <AppearancesPanel entityId={entity.id} worldSlug={worldSlug} />

      <div className={styles.footerActions}>
        <button
          className={styles.dangerBtn}
          onClick={deleteEntity}
          disabled={saving}
        >
          Delete Entity
        </button>
      </div>
    </div>
  );
}
