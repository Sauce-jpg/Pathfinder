'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import styles from './archive.module.css';
import { MarkdownView } from '../../MarkdownEditor';

type Version = {
  id: string;
  name: string;
  subtype: string | null;
  status: string;
  tags: string[] | null;
  data: Record<string, unknown> | null;
  doc: string | null;
  saved_by: string | null;
  created_at: string;
};

type UserName = { id: string; display_name: string };

type Props = {
  entityId: string;
  /** Called after a successful restore so the parent reloads its state. */
  onRestored: () => void;
};

export default function VersionsPanel({ entityId, onRestored }: Props) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('ra_versions')
      .select(
        'id, name, subtype, status, tags, data, doc, saved_by, created_at'
      )
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      setError(error.message);
      return;
    }
    const list = (data as Version[]) ?? [];
    setVersions(list);

    const ids = Array.from(
      new Set(list.map((v) => v.saved_by).filter(Boolean))
    ) as string[];
    if (ids.length > 0) {
      const { data: nameRows } = await supabase.rpc('hub_user_names', {
        p_ids: ids,
      });
      setNames(
        new Map(
          ((nameRows as UserName[]) ?? []).map((n) => [n.id, n.display_name])
        )
      );
    }
  }, [entityId]);

  useEffect(() => {
    load();
  }, [load]);

  async function restore(v: Version) {
    const ok = window.confirm(
      `Restore the version from ${new Date(v.created_at).toLocaleString(
        'sv-SE'
      )}? The current state is snapshotted first, so nothing is lost.`
    );
    if (!ok) return;
    setWorking(true);
    setError(null);
    const { error } = await supabase
      .from('ra_entities')
      .update({
        name: v.name,
        subtype: v.subtype,
        status: v.status,
        tags: v.tags ?? [],
        data: v.data ?? {},
        doc: v.doc ?? '',
        updated_at: new Date().toISOString(),
      })
      .eq('id', entityId);
    setWorking(false);
    if (error) {
      setError(error.message);
      return;
    }
    setExpandedId(null);
    onRestored();
    load();
  }

  if (versions.length === 0 && !error) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>History</h2>
      <p className={styles.mutedSmall}>
        The last 30 saved versions. Restoring snapshots the current state
        first — nothing is ever lost.
      </p>
      {error && <div className={styles.error}>{error}</div>}

      {versions.map((v) => {
        const expanded = expandedId === v.id;
        const dataEntries = Object.entries(v.data ?? {}).filter(
          ([, val]) => val !== null && val !== undefined && val !== ''
        );
        return (
          <div key={v.id} className={styles.versionBlock}>
            <div className={styles.versionRow}>
              <span className={styles.versionDate}>
                {new Date(v.created_at).toLocaleString('sv-SE', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </span>
              <span className={styles.versionName}>{v.name}</span>
              <span className={styles.versionMeta}>
                {v.status}
                {v.subtype ? ` · ${v.subtype}` : ''}
                {v.saved_by
                  ? ` · by ${names.get(v.saved_by) ?? 'unknown'}`
                  : ''}
              </span>
              <div className={styles.versionBtns}>
                <button
                  className={styles.smallVersionBtn}
                  onClick={() => setExpandedId(expanded ? null : v.id)}
                >
                  {expanded ? 'Close' : 'View'}
                </button>
                <button
                  className={styles.smallVersionBtn}
                  onClick={() => restore(v)}
                  disabled={working}
                >
                  Restore
                </button>
              </div>
            </div>
            {expanded && (
              <div className={styles.versionDetail}>
                {(v.tags ?? []).length > 0 && (
                  <p className={styles.versionMeta}>
                    tags: {(v.tags ?? []).map((t) => `#${t}`).join(' ')}
                  </p>
                )}
                {dataEntries.length > 0 && (
                  <div className={styles.versionData}>
                    {dataEntries.map(([k, val]) => (
                      <div key={k} className={styles.versionDataRow}>
                        <span className={styles.versionDataKey}>{k}</span>
                        <span>
                          {Array.isArray(val)
                            ? (val as unknown[]).join(', ')
                            : String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {v.doc?.trim() ? (
                  <MarkdownView source={v.doc} />
                ) : (
                  <p className={styles.mutedSmall}>No documentation.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
