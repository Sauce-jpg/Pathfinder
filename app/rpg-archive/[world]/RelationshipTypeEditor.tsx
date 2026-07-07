'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import styles from './world.module.css';
import FieldBuilder, {
  FieldDef,
  keyify,
  validateFields,
} from './FieldBuilder';
import { EntityType } from './EntityTypeEditor';

export type RelationshipType = {
  id: string;
  world_id: string;
  internal_name: string;
  display_name: string;
  inverse_name: string | null;
  description: string | null;
  allowed_source_types: string[];
  allowed_target_types: string[];
  metadata_schema: FieldDef[];
  color: string | null;
};

type Props = {
  worldId: string;
  entityTypes: EntityType[];
  existing: RelationshipType | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function RelationshipTypeEditor({
  worldId,
  entityTypes,
  existing,
  onClose,
  onSaved,
}: Props) {
  const [displayName, setDisplayName] = useState(existing?.display_name ?? '');
  const [internalName, setInternalName] = useState(
    existing?.internal_name ?? ''
  );
  const [nameTouched, setNameTouched] = useState(!!existing);
  const [inverseName, setInverseName] = useState(existing?.inverse_name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [color, setColor] = useState(existing?.color ?? '#c8900a');
  const [allowedSource, setAllowedSource] = useState<string[]>(
    existing?.allowed_source_types ?? []
  );
  const [allowedTarget, setAllowedTarget] = useState<string[]>(
    existing?.allowed_target_types ?? []
  );
  const [metaFields, setMetaFields] = useState<FieldDef[]>(
    existing?.metadata_schema ?? []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleDisplayNameChange(value: string) {
    setDisplayName(value);
    if (!nameTouched) setInternalName(keyify(value));
  }

  function togglePill(
    list: string[],
    setList: (v: string[]) => void,
    id: string
  ) {
    setList(
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
    );
  }

  async function save() {
    if (!displayName.trim() || !internalName.trim()) {
      setError('Display name and internal name are required.');
      return;
    }
    const fieldProblem = validateFields(metaFields);
    if (fieldProblem) {
      setError(fieldProblem);
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      world_id: worldId,
      display_name: displayName.trim(),
      internal_name: internalName.trim(),
      inverse_name: inverseName.trim() || null,
      description: description.trim() || null,
      color,
      allowed_source_types: allowedSource,
      allowed_target_types: allowedTarget,
      metadata_schema: metaFields,
      updated_at: new Date().toISOString(),
    };

    const query = existing
      ? supabase
          .from('ra_relationship_types')
          .update(payload)
          .eq('id', existing.id)
      : supabase.from('ra_relationship_types').insert(payload);

    const { error } = await query;
    setSaving(false);

    if (error) {
      setError(
        error.code === '23505'
          ? `A relationship type with internal name "${internalName}" already exists in this world.`
          : error.message
      );
      return;
    }
    onSaved();
  }

  async function deleteType() {
    if (!existing) return;
    const ok = window.confirm(
      `Delete the relationship type "${existing.display_name}"? Any relationships of this type will lose their definition. This cannot be undone.`
    );
    if (!ok) return;
    setSaving(true);
    const { error } = await supabase
      .from('ra_relationship_types')
      .delete()
      .eq('id', existing.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  }

  return (
    <div className={styles.editor}>
      <h3 className={styles.editorTitle}>
        {existing ? `Edit: ${existing.display_name}` : 'New Relationship Type'}
      </h3>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Display Name</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => handleDisplayNameChange(e.target.value)}
            placeholder="Member Of"
            autoFocus
          />
        </label>
        <label className={styles.field}>
          <span>Internal Name</span>
          <input
            type="text"
            value={internalName}
            onChange={(e) => {
              setNameTouched(true);
              setInternalName(keyify(e.target.value));
            }}
            placeholder="member_of"
          />
        </label>
        <label className={styles.field}>
          <span>Inverse Name (optional)</span>
          <input
            type="text"
            value={inverseName}
            onChange={(e) => setInverseName(e.target.value)}
            placeholder="Has Member"
          />
        </label>
        <label className={styles.field}>
          <span>Color</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className={styles.colorInput}
          />
        </label>
        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span>Description</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Membership in a faction, guild, or organization"
          />
        </label>
      </div>

      <div className={styles.pillSection}>
        <span className={styles.pillLabel}>
          Allowed Source Types{' '}
          <em>(none selected = any)</em>
        </span>
        <div className={styles.pillRow}>
          {entityTypes.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`${styles.pill} ${
                allowedSource.includes(t.id) ? styles.pillActive : ''
              }`}
              onClick={() => togglePill(allowedSource, setAllowedSource, t.id)}
            >
              {t.icon ? `${t.icon} ` : ''}
              {t.display_name}
            </button>
          ))}
          {entityTypes.length === 0 && (
            <span className={styles.muted}>
              No entity types defined yet — this relationship will allow any
              endpoints.
            </span>
          )}
        </div>
      </div>

      <div className={styles.pillSection}>
        <span className={styles.pillLabel}>
          Allowed Target Types <em>(none selected = any)</em>
        </span>
        <div className={styles.pillRow}>
          {entityTypes.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`${styles.pill} ${
                allowedTarget.includes(t.id) ? styles.pillActive : ''
              }`}
              onClick={() => togglePill(allowedTarget, setAllowedTarget, t.id)}
            >
              {t.icon ? `${t.icon} ` : ''}
              {t.display_name}
            </button>
          ))}
        </div>
      </div>

      <FieldBuilder
        title="Relationship Properties"
        entityTypes={entityTypes}
        emptyHint="No properties yet. Properties belong to the relationship itself — Joined, Rank, Status…"
        fields={metaFields}
        onChange={setMetaFields}
      />

      <div className={styles.editorActions}>
        {existing && (
          <button
            className={styles.dangerBtn}
            onClick={deleteType}
            disabled={saving}
          >
            Delete
          </button>
        )}
        <div className={styles.editorActionsRight}>
          <button className={styles.secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles.primaryBtn}
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Saving…' : existing ? 'Save Changes' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
