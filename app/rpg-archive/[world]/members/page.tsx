'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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

type Group = { id: string; name: string };
type GroupMember = { id: string; group_id: string; user_id: string };

const ROLES = ['co_gm', 'player', 'viewer'];

export default function MembersPage() {
  const params = useParams<{ world: string }>();
  const worldSlug = params.world;
  const router = useRouter();

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

  const [groups, setGroups] = useState<Group[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [newGroupName, setNewGroupName] = useState('');

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

    const [membersRes, friendsRes, groupsRes, gmRes] = await Promise.all([
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
      supabase
        .from('ra_player_groups')
        .select('id, name')
        .eq('world_id', w.id)
        .order('name', { ascending: true }),
      supabase
        .from('ra_player_group_members')
        .select('id, group_id, user_id')
        .eq('world_id', w.id),
    ]);

    if (!groupsRes.error) setGroups((groupsRes.data as Group[]) ?? []);
    if (!gmRes.error)
      setGroupMembers((gmRes.data as GroupMember[]) ?? []);

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

  async function createGroup() {
    if (!world || !newGroupName.trim()) return;
    const { error } = await supabase.from('ra_player_groups').insert({
      world_id: world.id,
      name: newGroupName.trim(),
    });
    if (error) {
      setError(
        error.code === '23505'
          ? 'A group with that name already exists.'
          : error.message
      );
      return;
    }
    setNewGroupName('');
    loadAll();
  }

  async function deleteGroup(g: Group) {
    const ok = window.confirm(
      `Delete the group "${g.name}"? Reveals granted to it stop applying.`
    );
    if (!ok) return;
    const { error } = await supabase
      .from('ra_player_groups')
      .delete()
      .eq('id', g.id);
    if (error) setError(error.message);
    else loadAll();
  }

  async function addToGroup(g: Group, userId: string) {
    if (!world || !userId) return;
    const { error } = await supabase.from('ra_player_group_members').insert({
      group_id: g.id,
      world_id: world.id,
      user_id: userId,
    });
    if (error) setError(error.message);
    else loadAll();
  }

  async function removeFromGroup(gm: GroupMember) {
    const { error } = await supabase
      .from('ra_player_group_members')
      .delete()
      .eq('id', gm.id);
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
                  {m.status === 'accepted' && (
                    <button
                      className={styles.secondaryBtn}
                      title="See the world exactly as this member sees it"
                      onClick={() =>
                        router.push(
                          `/rpg-archive/${worldSlug}/play?as=${m.user_id}`
                        )
                      }
                    >
                      Preview
                    </button>
                  )}
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

      <section className={styles.group}>
        <h2 className={styles.sectionTitle}>Player Groups</h2>
        <p className={styles.mutedSmall}>
          Groups make reveals easier — reveal to "Party" instead of each
          player individually.
        </p>

        <div className={styles.card} style={{ marginTop: '0.75rem' }}>
          <div className={styles.inviteRow}>
            <input
              type="text"
              className={styles.groupInput}
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Party, Faction A, Spectators…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') createGroup();
              }}
            />
            <button
              className={styles.primaryBtn}
              onClick={createGroup}
              disabled={!newGroupName.trim()}
            >
              Create Group
            </button>
          </div>
        </div>

        {groups.map((g) => {
          const inGroup = groupMembers.filter((gm) => gm.group_id === g.id);
          const inGroupIds = new Set(inGroup.map((gm) => gm.user_id));
          const addable = members
            .filter(
              (m) => m.status === 'accepted' && !inGroupIds.has(m.user_id)
            )
            .map((m) => m.user_id);
          return (
            <div key={g.id} className={styles.groupCard}>
              <div className={styles.groupHeader}>
                <span className={styles.groupName}>{g.name}</span>
                <button
                  className={styles.dangerBtn}
                  onClick={() => deleteGroup(g)}
                >
                  Delete
                </button>
              </div>
              <div className={styles.chipRow}>
                {inGroup.length === 0 && (
                  <span className={styles.rowMeta}>no members yet</span>
                )}
                {inGroup.map((gm) => (
                  <span key={gm.id} className={styles.memberChip}>
                    {nameOf(gm.user_id)}
                    <button
                      onClick={() => removeFromGroup(gm)}
                      title="Remove from group"
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {addable.length > 0 && (
                  <select
                    className={styles.roleSelect}
                    value=""
                    onChange={(e) => addToGroup(g, e.target.value)}
                  >
                    <option value="">+ add member</option>
                    {addable.map((id) => (
                      <option key={id} value={id}>
                        {nameOf(id)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
