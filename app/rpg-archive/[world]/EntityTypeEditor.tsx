'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import styles from './world.module.css';

export type FieldType =
  | 'short_text'
  | 'long_text'
  | 'markdown'
  | 'number'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'dropdown'
  | 'multiselect'
  | 'entity_ref'
  | 'asset_ref'
  | 'url';

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[]; // dropdown / multiselect only
};

export type EntityType = {
  id: string;
  world_id: string;
  internal_name: string;
  display_name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  fields: FieldDef[];
  enabled: boolean;
  sort_order: number;
};

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'short_text', label: 'Short Text' },
  { value: 'long_text', label: 'Long Text' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'number', label: 'Number' },
  { value: 'decimal', label: 'Decimal' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'multiselect', label: 'Multi-select' },
  { value: 'entity_ref', label: 'Entity Reference' },
  { value: 'asset_ref', label: 'Asset Reference' },
  { value: 'url', label: 'URL' },
];

function keyify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

type Props = {
  worldId: string;
  existing: EntityType | null;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: () => void;
};

export default function EntityTypeEditor({
  worldId,
  existing,
  nextSortOrder,
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleDisplayNameChange(value: string) {
    setDisplayName(value);
    if (!nameTouched) setInternalName(keyify(value));
  }

  function updateField(index: number, patch: Partial<FieldDef>) {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f))
    );
  }

  function addField() {
    setFields((prev) => [
      ...prev,
      { key: '', label: '', type: 'short_text', required: false },
    ]);
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  function moveField(index: number, direction: -1 | 1) {
    setFields((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function validate(): string | null {
    if (!displayName.trim()) return 'Display name is required.';
    if (!internalName.trim()) return 'Internal name is required.';
    const keys = new Set<string>();
    for (const f of fields) {
      if (!f.label.trim() || !f.key.trim())
        return 'Every field needs a label and a key.';
      if (keys.has(f.key)) return `Duplicate field key: "${f.key}".`;
      keys.add(f.key);
      if (
        (f.type === 'dropdown' || f.type === 'multiselect') &&
        (!f.options || f.options.length === 0)
      )
        return `Field "${f.label}" needs at least one option.`;
    }
    return null;
  }

  async function save() {
    const problem = validate();
    if (problem) {
      setError(problem);
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
      `Delete the entity type "${existing.display_name}"? Any entities of this type will lose their definition. This cannot be undone.`
    );
    if (!ok) return;
    setSaving(true);
    const { error } = await supabase
      .from('ra_entity_types')
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
      </div>

      <div className={styles.fieldsSection}>
        <div className={styles.fieldsHeader}>
          <h4 className={styles.fieldsTitle}>Field Definitions</h4>
          <button className={styles.secondaryBtn} onClick={addField}>
            + Add Field
          </button>
        </div>

        {fields.length === 0 && (
          <p className={styles.muted}>
            No structured fields yet. Fields make entities searchable,
            sortable, and filterable — Level, Faction, Alignment…
          </p>
        )}

        {fields.map((f, i) => (
          <div key={i} className={styles.fieldRow}>
            <input
              type="text"
              className={styles.fieldRowLabel}
              value={f.label}
              placeholder="Label"
              onChange={(e) => {
                const label = e.target.value;
                updateField(i, {
                  label,
                  key: f.key === keyify(f.label) || f.key === ''
                    ? keyify(label)
                    : f.key,
                });
              }}
            />
            <input
              type="text"
              className={styles.fieldRowKey}
              value={f.key}
              placeholder="key"
              onChange={(e) => updateField(i, { key: keyify(e.target.value) })}
            />
            <select
              className={styles.fieldRowType}
              value={f.type}
              onChange={(e) =>
                updateField(i, { type: e.target.value as FieldType })
              }
            >
              {FIELD_TYPES.map((ft) => (
                <option key={ft.value} value={ft.value}>
                  {ft.label}
                </option>
              ))}
            </select>
            <label className={styles.fieldRowRequired}>
              <input
                type="checkbox"
                checked={f.required}
                onChange={(e) => updateField(i, { required: e.target.checked })}
              />
              req
            </label>
            <div className={styles.fieldRowActions}>
              <button onClick={() => moveField(i, -1)} title="Move up">
                ↑
              </button>
              <button onClick={() => moveField(i, 1)} title="Move down">
                ↓
              </button>
              <button
                onClick={() => removeField(i)}
                title="Remove field"
                className={styles.dangerIcon}
              >
                ✕
              </button>
            </div>
            {(f.type === 'dropdown' || f.type === 'multiselect') && (
              <input
                type="text"
                className={styles.fieldRowOptions}
                value={(f.options ?? []).join(', ')}
                placeholder="Options, comma, separated"
                onChange={(e) =>
                  updateField(i, {
                    options: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            )}
          </div>
        ))}
      </div>

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
          <button className={styles.primaryBtn} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : existing ? 'Save Changes' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
