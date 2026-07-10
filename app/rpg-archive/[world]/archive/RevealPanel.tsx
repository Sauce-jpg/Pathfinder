'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import styles from './archive.module.css';

type Reveal = {
  id: string;
  subject_type: string;
  subject_id: string | null;
  field_key: string | null;
  note: string | null;
  revealed_at: string;
};

type Group = { id: string; name: string };
type Member = { user_id: string; role: string };
type UserName = { id: string; display_name: string };

type Props = {
  worldId: string;
  targetType: 'entity' | 'relationship';
  targetId: string;
  compact?: boolean;
  /** Field definitions of the entity's type — enables partial reveal. */
  fields?: { key: string; label: string }[];
};

export default function RevealPanel({
  worldId,
  targetType,
  targetId,
  compact,
  fields,
}: Props) {
  const [reveals, setReveals] = useState<Reveal[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [players, setPlayers] = useState<string[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const [subject, setSubject] = useState('');
  const [scope, setScope] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setError(null);
    const [revealsRes, groupsRes, membersRes] = await Promise.all([
      supabase
        .from('ra_reveals')
        .select('id, subject_type, subject_id, field_key, note, revealed_at')
        .eq('world_id', worldId)
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .order('revealed_at', { ascending: true }),
      supabase
        .from('ra_player_groups')
        .select('id, name')
        .eq('world_id', worldId)
        .order('name', { ascending: true }),
      supabase
        .from('ra_world_members')
        .select('user_id, role')
        .eq('world_id', worldId)
        .eq('status', 'accepted')
        .in('role', ['player', 'viewer']),
    ]);

    if (revealsRes.error) setError(revealsRes.error.message);
    else setReveals((revealsRes.data as Reveal[]) ?? []);

    if (!groupsRes.error) setGroups((groupsRes.data as Group[]) ?? []);

    const playerIds = ((membersRes.data as Member[]) ?? []).map(
      (m) => m.user_id
    );
    setPlayers(playerIds);

    if (playerIds.length > 0) {
      const { data: nameRows } = await supabase.rpc('hub_user_names', {
        p_ids: playerIds,
      });
      setNames(
        new Map(
          ((nameRows as UserName[]) ?? []).map((n) => [n.id, n.display_name])
        )
      );
    }
  }, [worldId, targetType, targetId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function scopeLabel(key: string | null): string | null {
    if (!key) return null;
    if (key === '__doc') return 'Documentation';
    return fields?.find((f) => f.key === key)?.label ?? key;
  }

  function subjectLabel(r: Reveal): string {
    if (r.subject_type === 'all_players') return 'All Players';
    if (r.subject_type === 'group') {
      return `Group: ${
        groups.find((g) => g.id === r.subject_id)?.name ?? 'deleted group'
      }`;
    }
    return names.get(r.subject_id ?? '') ?? 'Unknown player';
  }

  async function grant() {
    if (!subject) return;
    setSaving(true);
    setError(null);

    let subject_type = 'all_players';
    let subject_id: string | null = null;
    if (subject.startsWith('group:')) {
      subject_type = 'group';
      subject_id = subject.slice(6);
    } else if (subject.startsWith('user:')) {
      subject_type = 'user';
      subject_id = subject.slice(5);
    }

    const { error } = await supabase.from('ra_reveals').insert({
      world_id: worldId,
      target_type: targetType,
      target_id: targetId,
      field_key: scope || null,
      subject_type,
      subject_id,
      note: note.trim() || null,
    });
    setSaving(false);
    if (error) {
      setError(
        error.code === '23505'
          ? 'Already revealed to that subject.'
          : error.message
      );
      return;
    }
    setSubject('');
    setScope('');
    setNote('');
    loadAll();
  }

  async function revoke(r: Reveal) {
    const { error } = await supabase
      .from('ra_reveals')
      .delete()
      .eq('id', r.id);
    if (error) setError(error.message);
    else loadAll();
  }

  const body = (
    <>
      {error && <div className={styles.error}>{error}</div>}

      {reveals.length === 0 ? (
        <p className={styles.mutedSmall}>
          Not revealed — players cannot see this {targetType}.
          {fields ? ' Reveal it whole, or one field at a time.' : ''}
        </p>
      ) : (
        reveals.map((r) => (
          <div key={r.id} className={styles.revealRow}>
            {r.field_key && (
              <span className={styles.revealScope}>
                {scopeLabel(r.field_key)}
              </span>
            )}
            <span className={styles.revealSubject}>{subjectLabel(r)}</span>
            <span className={styles.revealMeta}>
              {new Date(r.revealed_at).toLocaleDateString('sv-SE')}
            </span>
            {r.note && <span className={styles.revealMeta}>{r.note}</span>}
            <button
              className={styles.revokeBtn}
              onClick={() => revoke(r)}
              title="Revoke — hide from this subject again"
            >
              ✕
            </button>
          </div>
        ))
      )}

      <div className={styles.revealForm}>
        {fields && (
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="">Entire entity</option>
            <option value="__doc">Documentation only</option>
            {fields.map((f) => (
              <option key={f.key} value={f.key}>
                Field: {f.label}
              </option>
            ))}
          </select>
        )}
        <select value={subject} onChange={(e) => setSubject(e.target.value)}>
          <option value="">— reveal to —</option>
          <option value="all">All Players</option>
          {groups.map((g) => (
            <option key={g.id} value={`group:${g.id}`}>
              Group: {g.name}
            </option>
          ))}
          {players.map((id) => (
            <option key={id} value={`user:${id}`}>
              {names.get(id) ?? 'Player'}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional): discovered in session 4…"
        />
        <button
          className={styles.smallRevealBtn}
          onClick={grant}
          disabled={saving || !subject}
        >
          Reveal
        </button>
      </div>
    </>
  );

  if (compact) {
    return (
      <div className={styles.revealCompact}>
        <span className={styles.revealTitle}>Player Visibility</span>
        {body}
      </div>
    );
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Player Visibility</h2>
      <p className={styles.mutedSmall}>
        Progressive reveal — grant access piece by piece. Drafts and recycled
        entities stay hidden regardless.
      </p>
      {body}
    </section>
  );
}
