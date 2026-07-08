'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from './members.module.css';

type World = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  appearance: { accent?: string };
};

type Member = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: string;
  accepted_at: string | null;
};

type Friendship = {
  id: string;
  user_id: string;
  friend_id: string;
  status: string;
};

type UserName = { id: string; display_name: string; avatar_url: string | null };

const ROLES = ['co_gm', 'player', 'viewer'];

export default function MembersPage() {
  const params = useParams<{ world: string }>();
  const worldSlug = params.world;

  const [myId, setMyId] = useState<string | null>(null);
  const [world, setWorld] = useState<World | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [names, setNames] = useState<Map<string, UserName>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteId, setInviteId] = useState('');
  const [inviteRole, setInviteRole] = useState('player');
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    setMyId(uid);

    const { data: w, error: wErr } = await supabase
      .from('ra_worlds')
      .select('id, name, slug, owner_id, appearance')
      .eq('slug', worldSlug)
      .single();

    if (wErr || !w) {
      setError(wErr?.message ?? 'World not found.');
      setLoading(false);
      return;
    }
    setWorld(w as World);

    const [membersRes, friendsRes] = await Promise.all([
      supabase
        .from('ra_world_members')
        .select('id, user_id, role, status, created_at, accepted_at')
        .eq('world_id', w.id)
        .order('created_at', { ascending: true }),
      uid
        ? supabase
            .from('friendships')
            .select('id, user_id, friend_id, status')
            .or(`user_id.eq.${uid},friend_id.eq.${uid}`)
            .eq('status', 'accepted')
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (membersRes.error) setError(membersRes.error.message);
    const memberList = (membersRes.data as Member[]) ?? [];
    setMembers(memberList);

    const fIds = ((friendsRes.data as Friendship[]) ?? []).map((f) =>
      f.user_id === uid ? f.friend_id : f.user_id
    );
    setFriendIds(fIds);

    const allIds = Array.from(
      new Set([
        ...memberList.map((m) => m.user_id),
        ...fIds,
        w.owner_id as string,
      ])
    );
    if (allIds.length > 0) {
      const { data: nameRows } = await supabase.rpc('hub_user_names', {
        p_ids: allIds,
      });
      setNames(
        new Map(((nameRows as UserName[]) ?? []).map((n) => [n.id, n]))
      );
    }
    setLoading(false);
  }, [worldSlug]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const accent = world?.appearance?.accent || '#c8900a';

  function nameOf(id: string): string {
    return names.get(id)?.display_name ?? 'Unknown user';
  }

  const memberIds = new Set(members.map((m) => m.user_id));
  const invitable = friendIds.filter((id) => !memberIds.has(id));

  async function invite() {
    if (!world || !inviteId) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase.from('ra_world_members').insert({
      world_id: world.id,
      user_id: inviteId,
      role: inviteRole,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setInviteId('');
    loadAll();
  }

  async function setRole(m: Member, role: string) {
    const { error } = await supabase
      .from('ra_world_members')
      .update({ role })
      .eq('id', m.id);
    if (error) setError(error.message);
    else loadAll();
  }

  async function remove(m: Member) {
    const ok = window.confirm(
      `Remove ${nameOf(m.user_id)} from ${world?.name}? They will lose all access.`
    );
    if (!ok) return;
    const { error } = await supabase
      .from('ra_world_members')
      .update({ status: 'removed' })
      .eq('id', m.id);
    if (error) setError(error.message);
    else loadAll();
  }

  async function reinvite(m: Member) {
    const { error } = await supabase
      .from('ra_world_members')
      .update({ status: 'invited', accepted_at: null })
      .eq('id', m.id);
    if (error) setError(error.message);
    else loadAll();
  }

  if (loading) {
    return (
      <div className={styles.wrap}>
        <p className={styles.muted}>Loading members…</p>
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

  return (
    <div className={styles.wrap} style={{ ['--ra-accent' as string]: accent }}>
      <Link href={`/rpg-archive/${worldSlug}`} className={styles.backLink}>
        ← {world.name}
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>Members</h1>
        <p className={styles.subtitle}>
          Who can enter {world.name} — and as what. Players see nothing until
          you reveal it.
        </p>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Invite a Friend</h2>
        {invitable.length === 0 ? (
          <p className={styles.muted}>
            No friends available to invite.{' '}
            <Link href="/rpg-archive/friends" className={styles.inlineLink}>
              Manage friends →
            </Link>
          </p>
        ) : (
          <div className={styles.inviteRow}>
            <select
              value={inviteId}
              onChange={(e) => setInviteId(e.target.value)}
            >
              <option value="">— choose friend —</option>
              {invitable.map((id) => (
                <option key={id} value={id}>
                  {nameOf(id)}
                </option>
              ))}
            </select>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.replace('_', '-')}
                </option>
              ))}
            </select>
            <button
              className={styles.primaryBtn}
              onClick={invite}
              disabled={saving || !inviteId}
            >
              Invite
            </button>
          </div>
        )}
        <p className={styles.mutedSmall}>
          co-gm: full access · player: sees only what you reveal · viewer:
          read-only reveals
        </p>
      </section>

      <section className={styles.group}>
        <h2 className={styles.sectionTitle}>
          Members ({members.length + 1})
        </h2>

        <div className={styles.row}>
          <span className={styles.rowName}>{nameOf(world.owner_id)}</span>
          <span className={styles.roleTag}>owner</span>
          {world.owner_id === myId && (
            <span className={styles.rowMeta}>(you)</span>
          )}
        </div>

        {members.map((m) => (
          <div key={m.id} className={styles.row}>
            <span className={styles.rowName}>{nameOf(m.user_id)}</span>
            <span
              className={`${styles.statusTag} ${
                m.status === 'accepted' ? styles.statusAccepted : ''
              }`}
            >
              {m.status}
            </span>
            {m.status !== 'removed' ? (
              <>
                <select
                  className={styles.roleSelect}
                  value={m.role}
                  onChange={(e) => setRole(m, e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.replace('_', '-')}
                    </option>
                  ))}
                </select>
                <div className={styles.rowActions}>
                  <button
                    className={styles.dangerBtn}
                    onClick={() => remove(m)}
                  >
                    Remove
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.rowActions}>
                <button
                  className={styles.secondaryBtn}
                  onClick={() => reinvite(m)}
                >
                  Re-invite
                </button>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
