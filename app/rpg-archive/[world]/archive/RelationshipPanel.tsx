'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from './archive.module.css';
import DynamicFields from './DynamicFields';
import { RelationshipType } from '../RelationshipTypeEditor';

type EntityRef = {
  id: string;
  name: string;
  slug: string;
  entity_type_id: string;
};

type RelRow = {
  id: string;
  relationship_type_id: string;
  source_id: string;
  target_id: string;
  properties: Record<string, unknown>;
  status: string;
  sort_order: number;
  relationship_type: RelationshipType;
  source: EntityRef;
  target: EntityRef;
};

const STATUSES = ['active', 'former', 'historical'];

type Props = {
  worldSlug: string;
  worldId: string;
  entityId: string;
  entityTypeId: string;
};

export default function RelationshipPanel({
  worldSlug,
  worldId,
  entityId,
  entityTypeId,
}: Props) {
  const [rels, setRels] = useState<RelRow[]>([]);
  const [relTypes, setRelTypes] = useState<RelationshipType[]>([]);
  const [entities, setEntities] = useState<EntityRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state — used for both create and edit
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [typeId, setTypeId] = useState('');
  const [otherId, setOtherId] = useState('');
  const [props, setProps] = useState<Record<string, unknown>>({});
  const [status, setStatus] = useState('active');
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [relsRes, typesRes, entsRes] = await Promise.all([
      supabase
        .from('ra_relationships')
        .select(
          '*, relationship_type:ra_relationship_types(*), source:ra_entities!source_id(id,name,slug,entity_type_id), target:ra_entities!target_id(id,name,slug,entity_type_id)'
        )
        .eq('world_id', worldId)
        .or(`source_id.eq.${entityId},target_id.eq.${entityId}`)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('ra_relationship_types')
        .select('*')
        .eq('world_id', worldId)
        .order('display_name', { ascending: true }),
      supabase
        .from('ra_entities')
        .select('id, name, slug, entity_type_id')
        .eq('world_id', worldId)
        .neq('id', entityId)
        .neq('status', 'deleted')
        .order('name', { ascending: true }),
    ]);

    if (relsRes.error) setError(relsRes.error.message);
    else setRels((relsRes.data as unknown as RelRow[]) ?? []);

    if (typesRes.error) setError(typesRes.error.message);
    else setRelTypes((typesRes.data as RelationshipType[]) ?? []);

    if (entsRes.error) setError(entsRes.error.message);
    else setEntities((entsRes.data as EntityRef[]) ?? []);

    setLoading(false);
  }, [worldId, entityId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const outgoing = rels.filter((r) => r.source_id === entityId);
  const incoming = rels.filter((r) => r.target_id === entityId);

  const selectedType = relTypes.find((t) => t.id === typeId) ?? null;

  // Relationship types valid for this entity in the chosen direction.
  const availableTypes = relTypes.filter((t) => {
    const allowed =
      direction === 'out' ? t.allowed_source_types : t.allowed_target_types;
    return allowed.length === 0 || allowed.includes(entityTypeId);
  });

  // Entities valid as the other endpoint, given the chosen type.
  const availableOthers = entities.filter((e) => {
    if (!selectedType) return true;
    const allowed =
      direction === 'out'
        ? selectedType.allowed_target_types
        : selectedType.allowed_source_types;
    return allowed.length === 0 || allowed.includes(e.entity_type_id);
  });

  function openCreate() {
    setEditingId(null);
    setDirection('out');
    setTypeId('');
    setOtherId('');
    setProps({});
    setStatus('active');
    setError(null);
    setFormOpen(true);
  }

  function openEdit(rel: RelRow) {
    setEditingId(rel.id);
    setDirection(rel.source_id === entityId ? 'out' : 'in');
    setTypeId(rel.relationship_type_id);
    setOtherId(rel.source_id === entityId ? rel.target_id : rel.source_id);
    setProps(rel.properties ?? {});
    setStatus(rel.status);
    setError(null);
    setFormOpen(true);
  }

  function missingRequired(): string[] {
    if (!selectedType) return [];
    return selectedType.metadata_schema
      .filter((f) => {
        if (!f.required) return false;
        const v = props[f.key];
        if (v === undefined || v === null || v === '') return true;
        if (Array.isArray(v) && v.length === 0) return true;
        return false;
      })
      .map((f) => f.label);
  }

  async function save() {
    if (!typeId || (!editingId && !otherId)) {
      setError('Choose a relationship type and an entity.');
      return;
    }
    const missing = missingRequired();
    if (missing.length > 0) {
      setError(`Required properties missing: ${missing.join(', ')}.`);
      return;
    }
    setSaving(true);
    setError(null);

    let dbError = null;
    if (editingId) {
      const { error } = await supabase
        .from('ra_relationships')
        .update({
          properties: props,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId);
      dbError = error;
    } else {
      const source_id = direction === 'out' ? entityId : otherId;
      const target_id = direction === 'out' ? otherId : entityId;
      const { error } = await supabase.from('ra_relationships').insert({
        world_id: worldId,
        relationship_type_id: typeId,
        source_id,
        target_id,
        properties: props,
        status,
      });
      dbError = error;
    }
    setSaving(false);

    if (dbError) {
      setError(dbError.message);
      return;
    }
    setFormOpen(false);
    loadAll();
  }

  async function deleteRel(rel: RelRow) {
    const ok = window.confirm(
      `Delete this "${rel.relationship_type.display_name}" relationship? Consider setting its status to former or historical instead — history is knowledge too.`
    );
    if (!ok) return;
    const { error } = await supabase
      .from('ra_relationships')
      .delete()
      .eq('id', rel.id);
    if (error) {
      setError(error.message);
      return;
    }
    setFormOpen(false);
    loadAll();
  }

  async function moveRel(rel: RelRow, dir: -1 | 1) {
    const group = rel.source_id === entityId ? outgoing : incoming;
    const idx = group.findIndex((r) => r.id === rel.id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= group.length) return;
    const reordered = [...group];
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].sort_order !== i) {
        const { error } = await supabase
          .from('ra_relationships')
          .update({ sort_order: i })
          .eq('id', reordered[i].id);
        if (error) {
          setError(error.message);
          return;
        }
      }
    }
    loadAll();
  }

  function propsSummary(rel: RelRow): string {
    const entries = Object.entries(rel.properties ?? {}).filter(
      ([, v]) => v !== null && v !== undefined && v !== ''
    );
    if (entries.length === 0) return '';
    return entries
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
      .join(' · ');
  }

  function renderRow(rel: RelRow, isOutgoing: boolean) {
    const other = isOutgoing ? rel.target : rel.source;
    const label = isOutgoing
      ? rel.relationship_type.display_name
      : rel.relationship_type.inverse_name ||
        `${rel.relationship_type.display_name} (incoming)`;
    const summary = propsSummary(rel);
    return (
      <div key={rel.id} className={styles.relRow}>
        <span className={styles.relType}>{label}</span>
        <Link
          href={`/rpg-archive/${worldSlug}/archive/${other.slug}`}
          className={styles.relLink}
        >
          {other.name}
        </Link>
        {rel.status !== 'active' && (
          <span className={styles.relStatus}>{rel.status}</span>
        )}
        {summary && <span className={styles.relProps}>{summary}</span>}
        <span className={styles.relRowBtns}>
          <button
            className={styles.relEditBtn}
            onClick={() => moveRel(rel, -1)}
            title="Move up"
          >
            ↑
          </button>
          <button
            className={styles.relEditBtn}
            onClick={() => moveRel(rel, 1)}
            title="Move down"
          >
            ↓
          </button>
          <button
            className={styles.relEditBtn}
            onClick={() => openEdit(rel)}
            title="Edit relationship"
          >
            ✎
          </button>
        </span>
      </div>
    );
  }

  return (
    <section className={styles.section}>
      <div className={styles.relHeader}>
        <h2 className={styles.sectionTitle}>Relationships</h2>
        <button className={styles.primaryBtn} onClick={openCreate}>
          + Add Relationship
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {formOpen && (
        <div className={styles.relForm}>
          <div className={styles.dynGrid}>
            <label className={styles.dynField}>
              <span>Direction</span>
              <select
                value={direction}
                disabled={!!editingId}
                onChange={(e) => {
                  setDirection(e.target.value as 'out' | 'in');
                  setTypeId('');
                  setOtherId('');
                }}
              >
                <option value="out">This entity → other</option>
                <option value="in">Other → this entity</option>
              </select>
            </label>
            <label className={styles.dynField}>
              <span>Relationship Type</span>
              <select
                value={typeId}
                disabled={!!editingId}
                onChange={(e) => {
                  setTypeId(e.target.value);
                  setOtherId('');
                  setProps({});
                }}
              >
                <option value="">— choose —</option>
                {availableTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.dynField}>
              <span>{direction === 'out' ? 'Target' : 'Source'} Entity</span>
              <select
                value={otherId}
                disabled={!!editingId}
                onChange={(e) => setOtherId(e.target.value)}
              >
                <option value="">— choose —</option>
                {availableOthers.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.dynField}>
              <span>Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedType && selectedType.metadata_schema.length > 0 && (
            <div className={styles.relPropsSection}>
              <h4 className={styles.fieldsTitle}>Properties</h4>
              <DynamicFields
                fields={selectedType.metadata_schema}
                data={props}
                onChange={(key, value) =>
                  setProps((prev) => ({ ...prev, [key]: value }))
                }
                entityOptions={entities}
                wikiPrefix={`/rpg-archive/${worldSlug}/archive`}
              />
            </div>
          )}

          <div className={styles.relFormActions}>
            {editingId && (
              <button
                className={styles.dangerBtn}
                onClick={() => {
                  const rel = rels.find((r) => r.id === editingId);
                  if (rel) deleteRel(rel);
                }}
                disabled={saving}
              >
                Delete
              </button>
            )}
            <div className={styles.relFormActionsRight}>
              <button
                className={styles.secondaryBtn}
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </button>
              <button
                className={styles.primaryBtn}
                onClick={save}
                disabled={saving}
              >
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className={styles.muted}>Loading relationships…</p>
      ) : rels.length === 0 && !formOpen ? (
        <p className={styles.muted}>
          No relationships yet. Connections are how the Archive becomes a
          world instead of a list.
        </p>
      ) : (
        <>
          {outgoing.length > 0 && (
            <div className={styles.relGroup}>
              <h4 className={styles.relGroupTitle}>Outgoing</h4>
              {outgoing.map((r) => renderRow(r, true))}
            </div>
          )}
          {incoming.length > 0 && (
            <div className={styles.relGroup}>
              <h4 className={styles.relGroupTitle}>Incoming</h4>
              {incoming.map((r) => renderRow(r, false))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
