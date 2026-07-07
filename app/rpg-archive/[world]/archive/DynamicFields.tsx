'use client';

import { FieldDef } from '../FieldBuilder';
import MarkdownEditor from '../../MarkdownEditor';
import styles from './archive.module.css';

export type EntityOption = { id: string; name: string };

type Props = {
  fields: FieldDef[];
  data: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  entityOptions: EntityOption[];
};

export default function DynamicFields({
  fields,
  data,
  onChange,
  entityOptions,
}: Props) {
  if (fields.length === 0) {
    return (
      <p className={styles.muted}>
        This entity type has no structured fields. You can add some in the
        world's configuration.
      </p>
    );
  }

  return (
    <div className={styles.dynGrid}>
      {fields.map((f) => {
        const value = data[f.key];
        const label = (
          <span>
            {f.label}
            {f.required && <em className={styles.req}> *</em>}
          </span>
        );

        switch (f.type) {
          case 'short_text':
          case 'url':
            return (
              <label key={f.key} className={styles.dynField}>
                {label}
                <input
                  type={f.type === 'url' ? 'url' : 'text'}
                  value={(value as string) ?? ''}
                  onChange={(e) => onChange(f.key, e.target.value)}
                />
              </label>
            );

          case 'long_text':
            return (
              <label
                key={f.key}
                className={`${styles.dynField} ${styles.dynWide}`}
              >
                {label}
                <textarea
                  rows={3}
                  value={(value as string) ?? ''}
                  onChange={(e) => onChange(f.key, e.target.value)}
                />
              </label>
            );

          case 'markdown':
            return (
              <div
                key={f.key}
                className={`${styles.dynField} ${styles.dynWide}`}
              >
                {label}
                <MarkdownEditor
                  value={(value as string) ?? ''}
                  onChange={(v) => onChange(f.key, v)}
                  rows={6}
                />
              </div>
            );

          case 'number':
          case 'decimal':
            return (
              <label key={f.key} className={styles.dynField}>
                {label}
                <input
                  type="number"
                  step={f.type === 'number' ? 1 : 'any'}
                  value={value === null || value === undefined ? '' : String(value)}
                  onChange={(e) =>
                    onChange(
                      f.key,
                      e.target.value === '' ? null : Number(e.target.value)
                    )
                  }
                />
              </label>
            );

          case 'boolean':
            return (
              <label key={f.key} className={styles.dynCheckbox}>
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(e) => onChange(f.key, e.target.checked)}
                />
                {label}
              </label>
            );

          case 'date':
            return (
              <label key={f.key} className={styles.dynField}>
                {label}
                <input
                  type="date"
                  value={(value as string) ?? ''}
                  onChange={(e) => onChange(f.key, e.target.value || null)}
                />
              </label>
            );

          case 'dropdown':
            return (
              <label key={f.key} className={styles.dynField}>
                {label}
                <select
                  value={(value as string) ?? ''}
                  onChange={(e) => onChange(f.key, e.target.value || null)}
                >
                  <option value="">— none —</option>
                  {(f.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
            );

          case 'multiselect': {
            const selected = Array.isArray(value) ? (value as string[]) : [];
            return (
              <div
                key={f.key}
                className={`${styles.dynField} ${styles.dynWide}`}
              >
                {label}
                <div className={styles.pillRow}>
                  {(f.options ?? []).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`${styles.pill} ${
                        selected.includes(opt) ? styles.pillActive : ''
                      }`}
                      onClick={() =>
                        onChange(
                          f.key,
                          selected.includes(opt)
                            ? selected.filter((s) => s !== opt)
                            : [...selected, opt]
                        )
                      }
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            );
          }

          case 'entity_ref':
            return (
              <label key={f.key} className={styles.dynField}>
                {label}
                <select
                  value={(value as string) ?? ''}
                  onChange={(e) => onChange(f.key, e.target.value || null)}
                >
                  <option value="">— none —</option>
                  {entityOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                </select>
              </label>
            );

          case 'asset_ref':
            return (
              <div key={f.key} className={styles.dynField}>
                {label}
                <span className={styles.mutedSmall}>
                  Asset references arrive with the Asset Library (Phase 4).
                </span>
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
