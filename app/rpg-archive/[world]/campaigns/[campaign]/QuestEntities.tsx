'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from './campaign.module.css';

type Involvement = {
  id: string;
  note: string | null;
  entity: { id: string; name: string; slug: string };
};

type EntityRow = { id: string; name: string; slug: string };

type Props = {
  worldId: string;
  worldSlug: string;
  campaignId: string;
  questId: string;
};

export default function QuestEntities({
  worldId,
  worldSlug,
  campaignId,
  questId,
}: Props) {
  const [rows, setRows] = useState<Involvement[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('ra_quest_entities')
      .select('id, note, entity:ra_entities(id, name, slug)')
      .eq('quest_id', questId)
      .order('created_at', { ascending: true });
    if (error) setError(error.message);
    else setRows((data as unknown as Involvement[]) ?? []);
  }, [questId]);

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

  async function add(entity: EntityRow) {
    setError(null);
    const { error } = await supabase.from('ra_quest_entities').insert({
      world_id: worldId,
      campaign_id: campaignId,
      quest_id: questId,
      entity_id: entity.id,
      note: note.trim() || null,
    });
    if (error) {
      setError(
        error.code === '23505'
          ? `"${entity.name}" is already involved in this quest.`
          : error.message
      );
      return;
    }
    setNote('');
    setSearch('');
    load();
  }

  async function remove(row: Involvement) {
    const { error } = await supabase
      .from('ra_quest_entities')
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
        <span className={styles.appearancesTitle}>Involved Entities</span>
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
          No entities linked — who or what does this quest involve?
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
                onClick={() => remove(r)}
                title="Remove from quest"
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
              placeholder="Note (optional): quest giver…"
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
                  onClick={() => add(e)}
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
