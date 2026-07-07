'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from './archive.module.css';

type Appearance = {
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

type Props = {
  entityId: string;
  worldSlug: string;
};

export default function AppearancesPanel({ entityId, worldSlug }: Props) {
  const [rows, setRows] = useState<Appearance[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ra_session_entities')
      .select(
        'id, note, session:ra_sessions(id, session_number, title, played_at), campaign:ra_campaigns(id, name, slug)'
      )
      .eq('entity_id', entityId);
    if (!error) {
      const sorted = ((data as unknown as Appearance[]) ?? []).sort((a, b) => {
        if (a.campaign.name !== b.campaign.name)
          return a.campaign.name.localeCompare(b.campaign.name);
        return b.session.session_number - a.session.session_number;
      });
      setRows(sorted);
    }
    setLoading(false);
  }, [entityId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Appearances</h2>
      {loading ? (
        <p className={styles.muted}>Loading appearances…</p>
      ) : rows.length === 0 ? (
        <p className={styles.muted}>
          Not featured in any sessions yet. Appearances are recorded from
          session notes in a campaign.
        </p>
      ) : (
        <>
          {rows.map((r) => (
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
                <span className={styles.relStatus}>{r.session.played_at}</span>
              )}
              {r.note && <span className={styles.relProps}>{r.note}</span>}
            </div>
          ))}
        </>
      )}
    </section>
  );
}
