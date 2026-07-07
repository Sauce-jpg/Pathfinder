'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from './archive.module.css';

type SessionAppearance = {
  id: string;
  note: string | null;
  session: {
    id: string;
    session_number: number;
    title: string | null;
    played_at: string | null;
  };
  campaign: { id: string; name: string; slug: string };
};

type QuestInvolvement = {
  id: string;
  note: string | null;
  quest: { id: string; name: string; status: string };
  campaign: { id: string; name: string; slug: string };
};

type Props = {
  entityId: string;
  worldSlug: string;
};

export default function AppearancesPanel({ entityId, worldSlug }: Props) {
  const [sessions, setSessions] = useState<SessionAppearance[]>([]);
  const [quests, setQuests] = useState<QuestInvolvement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [sessRes, questRes] = await Promise.all([
      supabase
        .from('ra_session_entities')
        .select(
          'id, note, session:ra_sessions(id, session_number, title, played_at), campaign:ra_campaigns(id, name, slug)'
        )
        .eq('entity_id', entityId),
      supabase
        .from('ra_quest_entities')
        .select(
          'id, note, quest:ra_quests(id, name, status), campaign:ra_campaigns(id, name, slug)'
        )
        .eq('entity_id', entityId),
    ]);

    if (!sessRes.error) {
      const sorted = (
        (sessRes.data as unknown as SessionAppearance[]) ?? []
      ).sort((a, b) => {
        if (a.campaign.name !== b.campaign.name)
          return a.campaign.name.localeCompare(b.campaign.name);
        return b.session.session_number - a.session.session_number;
      });
      setSessions(sorted);
    }
    if (!questRes.error) {
      const sorted = (
        (questRes.data as unknown as QuestInvolvement[]) ?? []
      ).sort((a, b) => {
        if (a.campaign.name !== b.campaign.name)
          return a.campaign.name.localeCompare(b.campaign.name);
        const aOpen = a.quest.status === 'open' ? 0 : 1;
        const bOpen = b.quest.status === 'open' ? 0 : 1;
        return aOpen - bOpen;
      });
      setQuests(sorted);
    }
    setLoading(false);
  }, [entityId]);

  useEffect(() => {
    load();
  }, [load]);

  const empty = sessions.length === 0 && quests.length === 0;

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Appearances</h2>
      {loading ? (
        <p className={styles.muted}>Loading appearances…</p>
      ) : empty ? (
        <p className={styles.muted}>
          Not featured in any sessions or quests yet. Appearances are
          recorded from within a campaign.
        </p>
      ) : (
        <>
          {sessions.length > 0 && (
            <div className={styles.relGroup}>
              <h4 className={styles.relGroupTitle}>Sessions</h4>
              {sessions.map((r) => (
                <div key={r.id} className={styles.relRow}>
                  <span className={styles.relType}>{r.campaign.name}</span>
                  <Link
                    href={`/rpg-archive/${worldSlug}/campaigns/${r.campaign.slug}`}
                    className={styles.relLink}
                  >
                    Session #{r.session.session_number}
                    {r.session.title ? ` — ${r.session.title}` : ''}
                  </Link>
                  {r.session.played_at && (
                    <span className={styles.relStatus}>
                      {r.session.played_at}
                    </span>
                  )}
                  {r.note && <span className={styles.relProps}>{r.note}</span>}
                </div>
              ))}
            </div>
          )}
          {quests.length > 0 && (
            <div className={styles.relGroup}>
              <h4 className={styles.relGroupTitle}>Quests</h4>
              {quests.map((r) => (
                <div key={r.id} className={styles.relRow}>
                  <span className={styles.relType}>{r.campaign.name}</span>
                  <Link
                    href={`/rpg-archive/${worldSlug}/campaigns/${r.campaign.slug}`}
                    className={styles.relLink}
                  >
                    {r.quest.name}
                  </Link>
                  <span className={styles.relStatus}>{r.quest.status}</span>
                  {r.note && <span className={styles.relProps}>{r.note}</span>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
