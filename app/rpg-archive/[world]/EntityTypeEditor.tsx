'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import styles from './world.module.css';
import FieldBuilder, {
  FieldDef,
  RefTypeOption,
  keyify,
  validateFields,
} from './FieldBuilder';

export type EntityType = {
  id: string;
  world_id: string;
  internal_name: string;
  display_name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  fields: FieldDef[];
  subtypes: string[];
  enabled: boolean;
  sort_order: number;
};

type Props = {
  worldId: string;
  existing: EntityType | null;
  nextSortOrder: number;
  entityTypes?: RefTypeOption[];
  onClose: () => void;
  onSaved: () => void;
};

export default function EntityTypeEditor({
  worldId,
  existing,
  nextSortOrder,
  entityTypes,
  onClose,
  onSaved,
}: Props) {
  const [displayName, setDisplayName] = useState(existing?.display_name ?? '');
  const [internalName, setInternalName] = useState(
    existing?.internal_name ?? ''
  );
  const [nameTouched, setNameTouched] = useState(!!existing);
  const [description, setDescription] = useState(existing?.description ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? '');
  const [color, setColor] = useState(existing?.color ?? '#c8900a');
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);
  const [fields, setFields] = useState<FieldDef[]>(existing?.fields ?? []);
  const [subtypes, setSubtypes] = useState<string[]>(existing?.subtypes ?? []);
  const [subtypesDraft, setSubtypesDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleDisplayNameChange(value: string) {
    setDisplayName(value);
    if (!nameTouched) setInternalName(keyify(value));
  }

  async function save() {
    if (!displayName.trim() || !internalName.trim()) {
      setError('Display name and internal name are required.');
      return;
    }
    const fieldProblem = validateFields(fields);
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
      description: description.trim() || null,
      icon: icon.trim() || null,
      color,
      enabled,
      fields,
      subtypes,
      sort_order: existing ? existing.sort_order : nextSortOrder,
      updated_at: new Date().toISOString(),
    };

    const query = existing
      ? supabase.from('ra_entity_types').update(payload).eq('id', existing.id)
      : supabase.from('ra_entity_types').insert(payload);

    const { error } = await query;
    setSaving(false);

    if (error) {
      setError(
        error.code === '23505'
          ? `An entity type with internal name "${internalName}" already exists in this world.`
          : error.message
      );
      return;
    }
    onSaved();
  }

  async function deleteType() {
    if (!existing) return;
    const ok = window.confirm(
      `Delete the entity type "${existing.display_name}"? This cannot be undone.`
    );
    if (!ok) return;
    setSaving(true);
    const { error } = await supabase
      .from('ra_entity_types')
      .delete()
      .eq('id', existing.id);
    setSaving(false);
    if (error) {
      setError(
        error.code === '23503'
          ? `"${existing.display_name}" is in use by existing entities. Delete or retype those entities first.`
          : error.message
      );
      return;
    }
    onSaved();
  }

  return (
    <div className={styles.editor}>
      <h3 className={styles.editorTitle}>
        {existing ? `Edit: ${existing.display_name}` : 'New Entity Type'}
      </h3>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Display Name</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => handleDisplayNameChange(e.target.value)}
            placeholder="Character"
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
            placeholder="character"
          />
        </label>
        <label className={styles.field}>
          <span>Icon (emoji)</span>
          <input
            type="text"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="🗡️"
            maxLength={4}
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
            placeholder="People and beings of the world"
          />
        </label>
        <label className={styles.checkboxField}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span>Enabled</span>
        </label>
        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span>Subtypes (comma separated, optional)</span>
          <input
            type="text"
            value={subtypesDraft ?? subtypes.join(', ')}
            onChange={(e) => {
              const raw = e.target.value;
              setSubtypesDraft(raw);
              setSubtypes(
                raw
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              );
            }}
            onBlur={() => setSubtypesDraft(null)}
            placeholder="Villain, Ally, Neutral"
          />
        </label>
      </div>

      <FieldBuilder
        title="Field Definitions"
        entityTypes={entityTypes}
        emptyHint="No structured fields yet. Fields make entities searchable, sortable, and filterable — Level, Faction, Alignment…"
        fields={fields}
        onChange={setFields}
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
