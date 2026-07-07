'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from './campaign.module.css';

type Appearance = {
  id: string;
  note: string | null;
  entity: { id: string; name: string; slug: string };
};

type EntityRow = { id: string; name: string; slug: string };

type Props = {
  worldId: string;
  worldSlug: string;
  campaignId: string;
  sessionId: string;
};

export default function SessionEntities({
  worldId,
  worldSlug,
  campaignId,
  sessionId,
}: Props) {
  const [rows, setRows] = useState<Appearance[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('ra_session_entities')
      .select('id, note, entity:ra_entities(id, name, slug)')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    if (error) setError(error.message);
    else setRows((data as unknown as Appearance[]) ?? []);
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  async function openPicker() {
    setPickerOpen(true);
    setError(null);
    const { data, error } = await supabase
      .from('ra_entities')
      .select('id, name, slug')
      .eq('world_id', worldId)
      .neq('status', 'deleted')
      .order('name', { ascending: true });
    if (error) setError(error.message);
    else setEntities((data as EntityRow[]) ?? []);
  }

  async function addAppearance(entity: EntityRow) {
    setError(null);
    const { error } = await supabase.from('ra_session_entities').insert({
      world_id: worldId,
      campaign_id: campaignId,
      session_id: sessionId,
      entity_id: entity.id,
      note: note.trim() || null,
    });
    if (error) {
      setError(
        error.code === '23505'
          ? `"${entity.name}" is already in this session.`
          : error.message
      );
      return;
    }
    setNote('');
    setSearch('');
    load();
  }

  async function removeAppearance(row: Appearance) {
    const { error } = await supabase
      .from('ra_session_entities')
      .delete()
      .eq('id', row.id);
    if (error) setError(error.message);
    else load();
  }

  const linkedIds = new Set(rows.map((r) => r.entity.id));
  const pickable = entities.filter(
    (e) =>
      !linkedIds.has(e.id) &&
      (!search || e.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className={styles.appearances}>
      <div className={styles.appearancesHeader}>
        <span className={styles.appearancesTitle}>Appearances</span>
        <button
          type="button"
          className={styles.smallBtn}
          onClick={() => (pickerOpen ? setPickerOpen(false) : openPicker())}
        >
          {pickerOpen ? 'Close' : '+ Add'}
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {rows.length === 0 && !pickerOpen && (
        <p className={styles.mutedSmall}>
          No entities linked yet — who showed up this session?
        </p>
      )}

      {rows.length > 0 && (
        <div className={styles.chipRow}>
          {rows.map((r) => (
            <span key={r.id} className={styles.entityChip}>
              <Link
                href={`/rpg-archive/${worldSlug}/archive/${r.entity.slug}`}
                className={styles.chipLink}
              >
                {r.entity.name}
              </Link>
              {r.note && <span className={styles.chipNote}>{r.note}</span>}
              <button
                type="button"
                className={styles.chipRemove}
                onClick={() => removeAppearance(r)}
                title="Remove from session"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {pickerOpen && (
        <div className={styles.pickerBox}>
          <div className={styles.pickerBar}>
            <input
              type="search"
              className={styles.pickerSearch}
              placeholder="Search entities…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            <input
              type="text"
              className={styles.pickerSearch}
              placeholder="Note (optional): gave the quest…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {pickable.length === 0 ? (
            <p className={styles.mutedSmall}>No matching entities.</p>
          ) : (
            <div className={styles.pickerList}>
              {pickable.slice(0, 30).map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className={styles.pickerItem}
                  onClick={() => addAppearance(e)}
                >
                  {e.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
