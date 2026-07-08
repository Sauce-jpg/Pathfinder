'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from './friends.module.css';

type Friendship = {
  id: string;
  user_id: string;
  friend_id: string;
  status: string;
};

type UserName = { id: string; display_name: string; avatar_url: string | null };

export default function FriendsPage() {
  const [myId, setMyId] = useState<string | null>(null);
  const [rows, setRows] = useState<Friendship[]>([]);
  const [names, setNames] = useState<Map<string, UserName>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    setMyId(uid);
    if (!uid) {
      setError('Not signed in.');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('friendships')
      .select('id, user_id, friend_id, status')
      .or(`user_id.eq.${uid},friend_id.eq.${uid}`);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const list = (data as Friendship[]) ?? [];
    setRows(list);

    const otherIds = Array.from(
      new Set(
        list.map((f) => (f.user_id === uid ? f.friend_id : f.user_id))
      )
    );
    if (otherIds.length > 0) {
      const { data: nameRows } = await supabase.rpc('hub_user_names', {
        p_ids: otherIds,
      });
      setNames(
        new Map(
          ((nameRows as UserName[]) ?? []).map((n) => [n.id, n])
        )
      );
    } else {
      setNames(new Map());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function nameOf(id: string): string {
    return names.get(id)?.display_name ?? 'Unknown user';
  }

  async function sendRequest() {
    if (!myId) return;
    const target = email.trim();
    if (!target) return;
    setSending(true);
    setError(null);
    setInfo(null);

    const { data: found, error: findErr } = await supabase.rpc(
      'hub_find_user_by_email',
      { p_email: target }
    );
    if (findErr) {
      setError(findErr.message);
      setSending(false);
      return;
    }
    const user = ((found as UserName[]) ?? [])[0];
    if (!user) {
      setError('No HUB account found with that email.');
      setSending(false);
      return;
    }

    const existing = rows.find(
      (f) =>
        (f.user_id === myId && f.friend_id === user.id) ||
        (f.user_id === user.id && f.friend_id === myId)
    );
    if (existing) {
      setInfo(
        existing.status === 'accepted'
          ? `You are already friends with ${user.display_name}.`
          : `A request with ${user.display_name} is already ${existing.status}.`
      );
      setSending(false);
      return;
    }

    const { error } = await supabase.from('friendships').insert({
      user_id: myId,
      friend_id: user.id,
      status: 'pending',
    });
    setSending(false);
    if (error) {
      setError(error.message);
      return;
    }
    setInfo(`Friend request sent to ${user.display_name}.`);
    setEmail('');
    loadAll();
  }

  async function respond(f: Friendship, accept: boolean) {
    setError(null);
    if (accept) {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', f.id);
      if (error) {
        setError(error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', f.id);
      if (error) {
        setError(error.message);
        return;
      }
    }
    loadAll();
  }

  async function removeFriend(f: Friendship) {
    const other = f.user_id === myId ? f.friend_id : f.user_id;
    const ok = window.confirm(`Remove ${nameOf(other)} as a friend?`);
    if (!ok) return;
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', f.id);
    if (error) {
      setError(error.message);
      return;
    }
    loadAll();
  }

  const incoming = rows.filter(
    (f) => f.friend_id === myId && f.status === 'pending'
  );
  const outgoing = rows.filter(
    (f) => f.user_id === myId && f.status === 'pending'
  );
  const friends = rows.filter((f) => f.status === 'accepted');

  return (
    <div className={styles.wrap}>
      <Link href="/rpg-archive" className={styles.backLink}>
        ← RPG Archive
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>Friends</h1>
        <p className={styles.subtitle}>
          Friends can be invited to your worlds. Friendship alone grants no
          access — invites and reveals do.
        </p>
      </header>

      {error && <div className={styles.error}>{error}</div>}
      {info && <p className={styles.info}>{info}</p>}

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Add a Friend</h2>
        <div className={styles.addRow}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@example.com"
            onKeyDown={(e) => {
              if (e.key === 'Enter') sendRequest();
            }}
          />
          <button
            className={styles.primaryBtn}
            onClick={sendRequest}
            disabled={sending}
          >
            {sending ? 'Searching…' : 'Send Request'}
          </button>
        </div>
        <p className={styles.mutedSmall}>
          Exact email of an existing HUB account.
        </p>
      </section>

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : (
        <>
          {incoming.length > 0 && (
            <section className={styles.group}>
              <h2 className={styles.sectionTitle}>
                Incoming Requests ({incoming.length})
              </h2>
              {incoming.map((f) => (
                <div key={f.id} className={styles.row}>
                  <span className={styles.rowName}>{nameOf(f.user_id)}</span>
                  <div className={styles.rowActions}>
                    <button
                      className={styles.primaryBtn}
                      onClick={() => respond(f, true)}
                    >
                      Accept
                    </button>
                    <button
                      className={styles.secondaryBtn}
                      onClick={() => respond(f, false)}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {outgoing.length > 0 && (
            <section className={styles.group}>
              <h2 className={styles.sectionTitle}>
                Sent Requests ({outgoing.length})
              </h2>
              {outgoing.map((f) => (
                <div key={f.id} className={styles.row}>
                  <span className={styles.rowName}>
                    {nameOf(f.friend_id)}
                  </span>
                  <span className={styles.rowMeta}>pending</span>
                  <div className={styles.rowActions}>
                    <button
                      className={styles.secondaryBtn}
                      onClick={() => respond(f, false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className={styles.group}>
            <h2 className={styles.sectionTitle}>
              Friends ({friends.length})
            </h2>
            {friends.length === 0 ? (
              <p className={styles.muted}>
                No friends yet — send a request above.
              </p>
            ) : (
              friends.map((f) => {
                const other = f.user_id === myId ? f.friend_id : f.user_id;
                return (
                  <div key={f.id} className={styles.row}>
                    <span className={styles.rowName}>{nameOf(other)}</span>
                    <div className={styles.rowActions}>
                      <button
                        className={styles.dangerBtn}
                        onClick={() => removeFriend(f)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </section>
        </>
      )}
    </div>
  );
}
