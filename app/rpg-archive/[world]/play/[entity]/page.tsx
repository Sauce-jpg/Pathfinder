'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from '../play.module.css';
import { MarkdownView } from '../../../../MarkdownEditor';

type World = {
  id: string;
  name: string;
  slug: string;
  appearance: { accent?: string };
};

type FieldDefLite = {
  key: string;
  label: string;
  type: string;
};

type PlayerEntity = {
  id: string;
  name: string;
  slug: string;
  subtype: string | null;
  doc: string;
  data: Record<string, unknown>;
  type_name: string;
  type_icon: string | null;
  type_color: string | null;
  fields: FieldDefLite[];
};

type PlayerRel = {
  id: string;
  source_id: string;
  target_id: string;
  other_id: string;
  other_name: string;
  other_slug: string;
  type_name: string;
  inverse_name: string | null;
  properties: Record<string, unknown>;
  status: string;
};

type PlayerAsset = {
  id: string;
  role: string | null;
  name: string;
  asset_type: string;
  url: string;
};

type RefName = { id: string; name: string; slug: string };

export default function PlayEntityPage() {
  const params = useParams<{ world: string; entity: string }>();
  const { world: worldSlug, entity: entitySlug } = params;

  const [world, setWorld] = useState<World | null>(null);
  const [entity, setEntity] = useState<PlayerEntity | null>(null);
  const [rels, setRels] = useState<PlayerRel[]>([]);
  const [assets, setAssets] = useState<PlayerAsset[]>([]);
  const [refNames, setRefNames] = useState<Map<string, RefName>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: w, error: wErr } = await supabase
      .from('ra_worlds')
      .select('id, name, slug, appearance')
      .eq('slug', worldSlug)
      .single();

    if (wErr || !w) {
      setError(wErr?.message ?? 'World not found or no access.');
      setLoading(false);
      return;
    }
    setWorld(w as World);

    const { data: entRows, error: eErr } = await supabase.rpc(
      'ra_player_get_entity',
      { p_world_id: w.id, p_slug: entitySlug }
    );

    if (eErr) {
      setError(eErr.message);
      setLoading(false);
      return;
    }
    const e = ((entRows as PlayerEntity[]) ?? [])[0];
    if (!e) {
      setEntity(null);
      setLoading(false);
      return;
    }
    setEntity(e);

    const [relsRes, assetsRes] = await Promise.all([
      supabase.rpc('ra_player_entity_relationships', {
        p_world_id: w.id,
        p_entity_id: e.id,
      }),
      supabase.rpc('ra_player_entity_assets', {
        p_world_id: w.id,
        p_entity_id: e.id,
      }),
    ]);

    if (!relsRes.error) setRels((relsRes.data as PlayerRel[]) ?? []);
    if (!assetsRes.error)
      setAssets((assetsRes.data as PlayerAsset[]) ?? []);

    // Resolve entity-reference field values to names (visible ones only).
    const refIds: string[] = [];
    for (const f of e.fields ?? []) {
      if (f.type !== 'entity_ref') continue;
      const v = e.data?.[f.key];
      if (typeof v === 'string' && v) refIds.push(v);
      else if (Array.isArray(v)) refIds.push(...(v as string[]));
    }
    if (refIds.length > 0) {
      const { data: resolved } = await supabase.rpc(
        'ra_player_resolve_entities',
        { p_world_id: w.id, p_ids: refIds }
      );
      setRefNames(
        new Map(((resolved as RefName[]) ?? []).map((r) => [r.id, r]))
      );
    }

    setLoading(false);
  }, [worldSlug, entitySlug]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const accent = world?.appearance?.accent || '#c8900a';

  function refLink(id: string) {
    const r = refNames.get(id);
    if (!r) return <span key={id}>Unknown</span>;
    return (
      <Link
        key={id}
        href={`/rpg-archive/${worldSlug}/play/${r.slug}`}
        className={styles.inlineLink}
      >
        {r.name}
      </Link>
    );
  }

  function renderValue(f: FieldDefLite, v: unknown) {
    if (f.type === 'boolean') return v ? 'Yes' : 'No';
    if (f.type === 'entity_ref') {
      if (typeof v === 'string') return refLink(v);
      if (Array.isArray(v)) {
        return (v as string[]).map((id, i) => (
          <span key={id}>
            {i > 0 && ', '}
            {refLink(id)}
          </span>
        ));
      }
      return null;
    }
    if (f.type === 'url' && typeof v === 'string') {
      return (
        <a href={v} target="_blank" rel="noreferrer" className={styles.inlineLink}>
          {v}
        </a>
      );
    }
    if (Array.isArray(v)) return (v as string[]).join(', ');
    return String(v);
  }

  const portrait =
    assets.find(
      (a) =>
        a.asset_type === 'image' && a.role?.toLowerCase() === 'portrait'
    ) ?? assets.find((a) => a.asset_type === 'image');

  const outgoing = entity
    ? rels.filter((r) => r.source_id === entity.id)
    : [];
  const incoming = entity
    ? rels.filter((r) => r.target_id === entity.id)
    : [];

  if (loading) {
    return (
      <div className={styles.wrap}>
        <p className={styles.muted}>Loading…</p>
      </div>
    );
  }

  if (!world || !entity) {
    return (
      <div className={styles.wrap}>
        <div className={styles.empty}>
          <p>This knowledge has not been revealed to you.</p>
          <p className={styles.muted}>
            {error ?? 'Ask your GM — or discover it in play.'}
          </p>
        </div>
        <p style={{ marginTop: '1rem' }}>
          <Link
            href={`/rpg-archive/${worldSlug}/play`}
            className={styles.backLink}
          >
            ← Back to the archive
          </Link>
        </p>
      </div>
    );
  }

  const filledFields = (entity.fields ?? []).filter((f) => {
    const v = entity.data?.[f.key];
    if (v === undefined || v === null || v === '') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    if (f.type === 'asset_ref') return false;
    return true;
  });

  return (
    <div className={styles.wrap} style={{ ['--ra-accent' as string]: accent }}>
      <Link
        href={`/rpg-archive/${worldSlug}/play`}
        className={styles.backLink}
      >
        ← {world.name}
      </Link>

      <header className={styles.entityHeader}>
        {portrait && (
          <div className={styles.portrait}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={portrait.url} alt={entity.name} />
          </div>
        )}
        <div>
          <span
            className={styles.typeBadge}
            style={{ color: entity.type_color || accent }}
          >
            {entity.type_icon ? `${entity.type_icon} ` : ''}
            {entity.type_name}
            {entity.subtype && ` · ${entity.subtype}`}
          </span>
          <h1 className={styles.title}>{entity.name}</h1>
        </div>
      </header>

      {filledFields.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Details</h2>
          <div className={styles.fieldGrid}>
            {filledFields.map((f) => (
              <div key={f.key} className={styles.fieldRow}>
                <span className={styles.fieldLabel}>{f.label}</span>
                <span className={styles.fieldValue}>
                  {renderValue(f, entity.data[f.key])}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {entity.doc?.trim() && (
        <section className={styles.section}>
          <MarkdownView
            source={entity.doc}
            wikiPrefix={`/rpg-archive/${worldSlug}/play`}
          />
        </section>
      )}

      {(outgoing.length > 0 || incoming.length > 0) && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Connections</h2>
          {[...outgoing, ...incoming].map((r) => {
            const isOut = r.source_id === entity.id;
            const label = isOut
              ? r.type_name
              : r.inverse_name || `${r.type_name} (incoming)`;
            const props = Object.entries(r.properties ?? {})
              .filter(([, v]) => v !== null && v !== undefined && v !== '')
              .slice(0, 3)
              .map(
                ([k, v]) =>
                  `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`
              )
              .join(' · ');
            return (
              <div key={r.id} className={styles.relRow}>
                <span className={styles.relType}>{label}</span>
                <Link
                  href={`/rpg-archive/${worldSlug}/play/${r.other_slug}`}
                  className={styles.relLink}
                >
                  {r.other_name}
                </Link>
                {r.status !== 'active' && (
                  <span className={styles.relStatus}>{r.status}</span>
                )}
                {props && <span className={styles.relProps}>{props}</span>}
              </div>
            );
          })}
        </section>
      )}

      {assets.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Media</h2>
          <div className={styles.assetGrid}>
            {assets.map((a) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className={styles.assetCard}
              >
                <div className={styles.assetThumb}>
                  {a.asset_type === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt={a.name} loading="lazy" />
                  ) : (
                    <span>📄</span>
                  )}
                </div>
                <span className={styles.assetName}>{a.name}</span>
                {a.role && <span className={styles.fieldLabel}>{a.role}</span>}
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
