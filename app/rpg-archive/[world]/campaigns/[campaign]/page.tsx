'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from './campaign.module.css';
import SessionEntities from './SessionEntities';

type World = {
  id: string;
  name: string;
  slug: string;
  appearance: { accent?: string };
};

type Campaign = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
};

type Session = {
  id: string;
  session_number: number;
  title: string | null;
  played_at: string | null;
  notes: string;
};

const CAMPAIGN_STATUSES = ['active', 'on hold', 'completed'];

export default function CampaignPage() {
  const params = useParams<{ world: string; campaign: string }>();
  const { world: worldSlug, campaign: campaignSlug } = params;
  const router = useRouter();

  const [world, setWorld] = useState<World | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Session editor: null = closed, otherwise the session being edited
  const [editing, setEditing] = useState<Session | null>(null);
  const [title, setTitle] = useState('');
  const [playedAt, setPlayedAt] = useState('');
  const [notes, setNotes] = useState('');
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

    const { data: c, error: cErr } = await supabase
      .from('ra_campaigns')
      .select('id, name, slug, description, status')
      .eq('world_id', w.id)
      .eq('slug', campaignSlug)
      .single();

    if (cErr || !c) {
      setError(cErr?.message ?? 'Campaign not found.');
      setLoading(false);
      return;
    }
    setCampaign(c as Campaign);

    const { data: s, error: sErr } = await supabase
      .from('ra_sessions')
      .select('id, session_number, title, played_at, notes')
      .eq('campaign_id', c.id)
      .order('session_number', { ascending: false });

    if (sErr) setError(sErr.message);
    else setSessions((s as Session[]) ?? []);

    setLoading(false);
  }, [worldSlug, campaignSlug]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const accent = world?.appearance?.accent || '#c8900a';

  async function setStatus(status: string) {
    if (!campaign) return;
    setCampaign({ ...campaign, status });
    const { error } = await supabase
      .from('ra_campaigns')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', campaign.id);
    if (error) setError(error.message);
  }

  async function createSession() {
    if (!campaign || !world) return;
    setSaving(true);
    setError(null);
    const nextNumber =
      sessions.length > 0
        ? Math.max(...sessions.map((s) => s.session_number)) + 1
        : 1;
    const { data, error } = await supabase
      .from('ra_sessions')
      .insert({
        world_id: world.id,
        campaign_id: campaign.id,
        session_number: nextNumber,
      })
      .select('id, session_number, title, played_at, notes')
      .single();
    setSaving(false);
    if (error || !data) {
      setError(error?.message ?? 'Could not create session.');
      return;
    }
    const s = data as Session;
    setSessions((prev) => [s, ...prev]);
    openEdit(s);
  }

  function openEdit(s: Session) {
    setEditing(s);
    setTitle(s.title ?? '');
    setPlayedAt(s.played_at ?? '');
    setNotes(s.notes ?? '');
    setError(null);
  }

  async function saveSession() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from('ra_sessions')
      .update({
        title: title.trim() || null,
        played_at: playedAt || null,
        notes,
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

  async function deleteSession() {
    if (!editing) return;
    const ok = window.confirm(
      `Delete Session ${editing.session_number}${
        editing.title ? ` — ${editing.title}` : ''
      }? This cannot be undone.`
    );
    if (!ok) return;
    setSaving(true);
    const { error } = await supabase
      .from('ra_sessions')
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

  async function deleteCampaign() {
    if (!campaign) return;
    const note =
      sessions.length > 0
        ? ` Its ${sessions.length} session${
            sessions.length === 1 ? '' : 's'
          } will be deleted too.`
        : '';
    const ok = window.confirm(
      `Delete the campaign "${campaign.name}"?${note} The Archive is not affected. This cannot be undone.`
    );
    if (!ok) return;
    const { error } = await supabase
      .from('ra_campaigns')
      .delete()
      .eq('id', campaign.id);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(`/rpg-archive/${worldSlug}`);
  }

  if (loading) {
    return (
      <div className={styles.wrap}>
        <p className={styles.muted}>Loading campaign…</p>
      </div>
    );
  }

  if (!world || !campaign) {
    return (
      <div className={styles.wrap}>
        <div className={styles.error}>{error ?? 'Campaign not found.'}</div>
        <Link href={`/rpg-archive/${worldSlug}`} className={styles.backLink}>
          ← World
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.wrap} style={{ ['--ra-accent' as string]: accent }}>
      <Link href={`/rpg-archive/${worldSlug}`} className={styles.backLink}>
        ← {world.name}
      </Link>

      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Campaign</p>
          <h1 className={styles.title}>{campaign.name}</h1>
          {campaign.description && (
            <p className={styles.subtitle}>{campaign.description}</p>
          )}
        </div>
        <div className={styles.headerActions}>
          <select
            className={styles.statusSelect}
            value={campaign.status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {CAMPAIGN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Link
            href={`/rpg-archive/${worldSlug}/archive`}
            className={styles.secondaryBtn}
          >
            Archive
          </Link>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Sessions</h2>
          <button
            className={styles.primaryBtn}
            onClick={createSession}
            disabled={saving || !!editing}
          >
            + New Session
          </button>
        </div>

        {editing && (
          <div className={styles.sessionEditor}>
            <h3 className={styles.editorTitle}>
              Session {editing.session_number}
            </h3>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Title</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="The Forgotten Shore"
                  autoFocus
                />
              </label>
              <label className={styles.field}>
                <span>Played</span>
                <input
                  type="date"
                  value={playedAt}
                  onChange={(e) => setPlayedAt(e.target.value)}
                />
              </label>
            </div>
            <label className={styles.notesLabel}>
              <span>Session Notes (markdown)</span>
              <textarea
                className={styles.docArea}
                rows={14}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={`## Recap\n\n## What Happened\n\n## Loot\n\n## Next Time`}
              />
            </label>
            <SessionEntities
              worldId={world.id}
              worldSlug={worldSlug}
              campaignId={campaign.id}
              sessionId={editing.id}
            />
            <div className={styles.editorActions}>
              <button
                className={styles.dangerBtn}
                onClick={deleteSession}
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
                  onClick={saveSession}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save Session'}
                </button>
              </div>
            </div>
          </div>
        )}

        {sessions.length === 0 && !editing ? (
          <div className={styles.empty}>
            <p>No sessions yet.</p>
            <p className={styles.muted}>
              Each session records one game night — recap, events, loot, and
              plans for next time.
            </p>
          </div>
        ) : (
          <div className={styles.sessionList}>
            {sessions
              .filter((s) => s.id !== editing?.id)
              .map((s) => (
                <button
                  key={s.id}
                  className={styles.sessionRow}
                  onClick={() => openEdit(s)}
                >
                  <span className={styles.sessionNumber}>
                    #{s.session_number}
                  </span>
                  <span className={styles.sessionTitle}>
                    {s.title || 'Untitled session'}
                  </span>
                  {s.played_at && (
                    <span className={styles.sessionDate}>{s.played_at}</span>
                  )}
                  {s.notes && (
                    <span className={styles.sessionPreview}>
                      {s.notes.replace(/[#*_>`-]/g, '').slice(0, 80)}
                      {s.notes.length > 80 ? '…' : ''}
                    </span>
                  )}
                </button>
              ))}
          </div>
        )}
      </section>

      <div className={styles.footerActions}>
        <button className={styles.dangerBtn} onClick={deleteCampaign}>
          Delete Campaign
        </button>
      </div>
    </div>
  );
}
