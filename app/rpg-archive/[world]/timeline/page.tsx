'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from './timeline.module.css';
import MarkdownEditor from '../../MarkdownEditor';
import EventEntities from './EventEntities';

type World = {
  id: string;
  name: string;
  slug: string;
  appearance: { accent?: string };
};

type WorldEvent = {
  id: string;
  name: string;
  date_label: string | null;
  sort_value: number;
  era: string | null;
  details: string;
};

export default function TimelinePage() {
  const params = useParams<{ world: string }>();
  const worldSlug = params.world;

  const [world, setWorld] = useState<World | null>(null);
  const [events, setEvents] = useState<WorldEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<WorldEvent | null>(null);
  const [name, setName] = useState('');
  const [dateLabel, setDateLabel] = useState('');
  const [sortValue, setSortValue] = useState('0');
  const [era, setEra] = useState('');
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);

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

    const { data, error } = await supabase
      .from('ra_events')
      .select('id, name, date_label, sort_value, era, details')
      .eq('world_id', w.id)
      .order('sort_value', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) setError(error.message);
    else setEvents((data as WorldEvent[]) ?? []);
    setLoading(false);
  }, [worldSlug]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const accent = world?.appearance?.accent || '#c8900a';

  async function createEvent() {
    if (!world) return;
    setSaving(true);
    setError(null);
    const nextSort =
      events.length > 0
        ? Math.max(...events.map((e) => Number(e.sort_value))) + 1
        : 0;
    const { data, error } = await supabase
      .from('ra_events')
      .insert({ world_id: world.id, name: 'New Event', sort_value: nextSort })
      .select('id, name, date_label, sort_value, era, details')
      .single();
    setSaving(false);
    if (error || !data) {
      setError(error?.message ?? 'Could not create event.');
      return;
    }
    const ev = data as WorldEvent;
    setEvents((prev) => [...prev, ev]);
    openEdit(ev);
  }

  function openEdit(ev: WorldEvent) {
    setEditing(ev);
    setName(ev.name);
    setDateLabel(ev.date_label ?? '');
    setSortValue(String(ev.sort_value));
    setEra(ev.era ?? '');
    setDetails(ev.details ?? '');
    setError(null);
  }

  async function saveEvent() {
    if (!editing) return;
    if (!name.trim()) {
      setError('Event name is required.');
      return;
    }
    const sv = Number(sortValue);
    if (Number.isNaN(sv)) {
      setError('Sort value must be a number (e.g. 1024 or 3.25).');
      return;
    }
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from('ra_events')
      .update({
        name: name.trim(),
        date_label: dateLabel.trim() || null,
        sort_value: sv,
        era: era.trim() || null,
        details,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editing.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEditing(null);
    loadAll();
  }

  async function deleteEvent() {
    if (!editing) return;
    const ok = window.confirm(
      `Delete the event "${editing.name}"? This cannot be undone.`
    );
    if (!ok) return;
    setSaving(true);
    const { error } = await supabase
      .from('ra_events')
      .delete()
      .eq('id', editing.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEditing(null);
    loadAll();
  }

  if (loading) {
    return (
      <div className={styles.wrap}>
        <p className={styles.muted}>Loading timeline…</p>
      </div>
    );
  }

  if (!world) {
    return (
      <div className={styles.wrap}>
        <div className={styles.error}>{error ?? 'World not found.'}</div>
        <Link href="/rpg-archive" className={styles.backLink}>
          ← All Worlds
        </Link>
      </div>
    );
  }

  let previousEra: string | null | undefined = undefined;

  return (
    <div className={styles.wrap} style={{ ['--ra-accent' as string]: accent }}>
      <Link href={`/rpg-archive/${worldSlug}`} className={styles.backLink}>
        ← {world.name}
      </Link>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Timeline</h1>
          <p className={styles.subtitle}>
            The history of {world.name}, in order.
          </p>
        </div>
        <button
          className={styles.primaryBtn}
          onClick={createEvent}
          disabled={saving || !!editing}
        >
          + New Event
        </button>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      {editing && (
        <div className={styles.editor}>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="The Fall of Bastion"
                autoFocus
              />
            </label>
            <label className={styles.field}>
              <span>Date Label</span>
              <input
                type="text"
                value={dateLabel}
                onChange={(e) => setDateLabel(e.target.value)}
                placeholder="Year 3, Spring"
              />
            </label>
            <label className={styles.field}>
              <span>Sort Value</span>
              <input
                type="number"
                step="any"
                value={sortValue}
                onChange={(e) => setSortValue(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Era (optional)</span>
              <input
                type="text"
                value={era}
                onChange={(e) => setEra(e.target.value)}
                placeholder="The Age of Ash"
              />
            </label>
          </div>
          <p className={styles.hint}>
            The sort value orders events — use year numbers, decimals for
            within-year ordering (3.25 = spring of year 3), negatives for
            before your era zero. Only the date label is shown.
          </p>
          <div className={styles.notesLabel}>
            <span>Details (markdown)</span>
            <MarkdownEditor
              value={details}
              onChange={setDetails}
              rows={8}
              placeholder={`## What happened\n\n## Consequences`}
            />
          </div>
          <EventEntities
            worldId={world.id}
            worldSlug={worldSlug}
            eventId={editing.id}
          />
          <div className={styles.editorActions}>
            <button
              className={styles.dangerBtn}
              onClick={deleteEvent}
              disabled={saving}
            >
              Delete
            </button>
            <div className={styles.editorActionsRight}>
              <button
                className={styles.secondaryBtn}
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                className={styles.primaryBtn}
                onClick={saveEvent}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {events.length === 0 && !editing ? (
        <div className={styles.empty}>
          <p>No events yet.</p>
          <p className={styles.muted}>
            Wars, coronations, cataclysms — the history that shaped{' '}
            {world.name} belongs here.
          </p>
        </div>
      ) : (
        <div className={styles.timeline}>
          {events
            .filter((ev) => ev.id !== editing?.id)
            .map((ev) => {
              const showEra =
                (ev.era ?? null) !== previousEra && (ev.era ?? '') !== '';
              previousEra = ev.era ?? null;
              return (
                <div key={ev.id}>
                  {showEra && (
                    <h2 className={styles.eraHeader}>{ev.era}</h2>
                  )}
                  <button
                    className={styles.eventRow}
                    onClick={() => openEdit(ev)}
                  >
                    <span className={styles.eventDot} />
                    <span className={styles.eventDate}>
                      {ev.date_label || '·'}
                    </span>
                    <span className={styles.eventName}>{ev.name}</span>
                    {ev.details && (
                      <span className={styles.eventPreview}>
                        {ev.details.replace(/[#*_>`-]/g, '').slice(0, 100)}
                        {ev.details.length > 100 ? '…' : ''}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
