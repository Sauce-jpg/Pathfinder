'use client';

import { useState } from 'react';
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
  multiple?: boolean; // entity_ref only: allow selecting several entities
  refTypes?: string[]; // entity_ref only: allowed entity type ids (empty = any)
  parent?: string; // markdown only: key of the chapter this is a sub-section of
};

export const FIELD_TYPES: { value: FieldType; label: string }[] = [
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

export function keyify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Returns an error message, or null if the field list is valid. */
export function validateFields(fields: FieldDef[]): string | null {
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

export type RefTypeOption = {
  id: string;
  display_name: string;
  icon: string | null;
};

type Props = {
  title: string;
  emptyHint: string;
  fields: FieldDef[];
  onChange: (fields: FieldDef[]) => void;
  entityTypes?: RefTypeOption[];
};

export default function FieldBuilder({
  title,
  emptyHint,
  fields,
  onChange,
  entityTypes,
}: Props) {
  // Raw text drafts for the options inputs, keyed by row index. Parsing on
  // every keystroke ate commas and spaces; the draft preserves exactly what
  // the user typed and is normalized on blur.
  const [optionDrafts, setOptionDrafts] = useState<Record<number, string>>(
    {}
  );

  function updateField(index: number, patch: Partial<FieldDef>) {
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function addField() {
    setOptionDrafts({});
    onChange([
      ...fields,
      { key: '', label: '', type: 'short_text', required: false },
    ]);
  }

  function removeField(index: number) {
    setOptionDrafts({});
    onChange(fields.filter((_, i) => i !== index));
  }

  function moveField(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    setOptionDrafts({});
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className={styles.fieldsSection}>
      <div className={styles.fieldsHeader}>
        <h4 className={styles.fieldsTitle}>{title}</h4>
        <button className={styles.secondaryBtn} onClick={addField}>
          + Add Field
        </button>
      </div>

      {fields.length === 0 && <p className={styles.muted}>{emptyHint}</p>}

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
                key:
                  f.key === keyify(f.label) || f.key === ''
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
              value={optionDrafts[i] ?? (f.options ?? []).join(', ')}
              placeholder="Options, comma, separated"
              onChange={(e) => {
                const raw = e.target.value;
                setOptionDrafts((d) => ({ ...d, [i]: raw }));
                updateField(i, {
                  options: raw
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                });
              }}
              onBlur={() =>
                setOptionDrafts((d) => {
                  const next = { ...d };
                  delete next[i];
                  return next;
                })
              }
            />
          )}
          {f.type === 'markdown' && (
            <div className={styles.refConfigRow}>
              <label className={styles.subOfLabel}>
                <span>Sub-section of</span>
                <select
                  value={f.parent ?? ''}
                  onChange={(e) =>
                    updateField(i, {
                      parent: e.target.value || undefined,
                    })
                  }
                >
                  <option value="">— none (top-level chapter) —</option>
                  {fields
                    .filter(
                      (o) =>
                        o.type === 'markdown' &&
                        o.key !== f.key &&
                        !o.parent
                    )
                    .map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label || o.key}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          )}
          {f.type === 'entity_ref' && (
            <div className={styles.refConfigRow}>
              <label className={styles.fieldRowRequired}>
                <input
                  type="checkbox"
                  checked={!!f.multiple}
                  onChange={(e) =>
                    updateField(i, { multiple: e.target.checked })
                  }
                />
                allow multiple
              </label>
              {(entityTypes ?? []).map((t) => {
                const active = (f.refTypes ?? []).includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`${styles.pill} ${
                      active ? styles.pillActive : ''
                    }`}
                    onClick={() => {
                      const cur = f.refTypes ?? [];
                      updateField(i, {
                        refTypes: active
                          ? cur.filter((x) => x !== t.id)
                          : [...cur, t.id],
                      });
                    }}
                  >
                    {t.icon ? `${t.icon} ` : ''}
                    {t.display_name}
                  </button>
                );
              })}
              <span className={styles.refHint}>none selected = any type</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
