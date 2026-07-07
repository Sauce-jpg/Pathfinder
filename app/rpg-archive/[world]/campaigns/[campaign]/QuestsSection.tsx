'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import styles from './campaign.module.css';
import QuestEntities from './QuestEntities';
import MarkdownEditor from '../../../MarkdownEditor';

type Quest = {
  id: string;
  name: string;
  details: string;
  status: string;
  created_at: string;
};

const QUEST_STATUSES = ['open', 'completed', 'failed', 'on hold'];

type Props = {
  worldId: string;
  worldSlug: string;
  campaignId: string;
};

export default function QuestsSection({
  worldId,
  worldSlug,
  campaignId,
}: Props) {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Quest | null>(null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('open');
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ra_quests')
      .select('id, name, details, status, created_at')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else {
      const rows = (data as Quest[]) ?? [];
      // Open quests first, then the rest, each newest-first.
      rows.sort((a, b) => {
        const aOpen = a.status === 'open' ? 0 : 1;
        const bOpen = b.status === 'open' ? 0 : 1;
        if (aOpen !== bOpen) return aOpen - bOpen;
        return b.created_at.localeCompare(a.created_at);
      });
      setQuests(rows);
    }
    setLoading(false);
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  async function createQuest() {
    setSaving(true);
    setError(null);
    const { data, error } = await supabase
      .from('ra_quests')
      .insert({
        world_id: worldId,
        campaign_id: campaignId,
        name: 'New Quest',
      })
      .select('id, name, details, status, created_at')
      .single();
    setSaving(false);
    if (error || !data) {
      setError(error?.message ?? 'Could not create quest.');
      return;
    }
    const q = data as Quest;
    setQuests((prev) => [q, ...prev]);
    openEdit(q);
  }

  function openEdit(q: Quest) {
    setEditing(q);
    setName(q.name);
    setStatus(q.status);
    setDetails(q.details ?? '');
    setError(null);
  }

  async function saveQuest() {
    if (!editing) return;
    if (!name.trim()) {
      setError('Quest name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from('ra_quests')
      .update({
        name: name.trim(),
        status,
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
    load();
  }

  async function deleteQuest() {
    if (!editing) return;
    const ok = window.confirm(
      `Delete the quest "${editing.name}"? This cannot be undone.`
    );
    if (!ok) return;
    setSaving(true);
    const { error } = await supabase
      .from('ra_quests')
      .delete()
      .eq('id', editing.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEditing(null);
    load();
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Quests</h2>
        <button
          className={styles.primaryBtn}
          onClick={createQuest}
          disabled={saving || !!editing}
        >
          + New Quest
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {editing && (
        <div className={styles.sessionEditor}>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Recover the Memory of the Ashen Barrow"
                autoFocus
              />
            </label>
            <label className={styles.field}>
              <span>Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {QUEST_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className={styles.notesLabel}>
            <span>Details (markdown)</span>
            <MarkdownEditor
              value={details}
              onChange={setDetails}
              rows={8}
              placeholder={`## Goal\n\n## Reward\n\n## Progress`}
            />
          </div>
          <QuestEntities
            worldId={worldId}
            worldSlug={worldSlug}
            campaignId={campaignId}
            questId={editing.id}
          />
          <div className={styles.editorActions}>
            <button
              className={styles.dangerBtn}
              onClick={deleteQuest}
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
                onClick={saveQuest}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Quest'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className={styles.muted}>Loading quests…</p>
      ) : quests.length === 0 && !editing ? (
        <div className={styles.empty}>
          <p>No quests yet.</p>
          <p className={styles.muted}>
            Track goals, rewards, and progress — and link the entities each
            quest involves.
          </p>
        </div>
      ) : (
        <div className={styles.sessionList}>
          {quests
            .filter((q) => q.id !== editing?.id)
            .map((q) => (
              <button
                key={q.id}
                className={styles.sessionRow}
                onClick={() => openEdit(q)}
              >
                <span className={styles.sessionTitle}>{q.name}</span>
                <span
                  className={`${styles.questStatus} ${
                    q.status === 'open' ? styles.questOpen : ''
                  }`}
                >
                  {q.status}
                </span>
                {q.details && (
                  <span className={styles.sessionPreview}>
                    {q.details.replace(/[#*_>`-]/g, '').slice(0, 80)}
                    {q.details.length > 80 ? '…' : ''}
                  </span>
                )}
              </button>
            ))}
        </div>
      )}
    </section>
  );
}
