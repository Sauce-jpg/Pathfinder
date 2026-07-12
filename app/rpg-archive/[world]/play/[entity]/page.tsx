'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from '../play.module.css';
import { MarkdownView } from '../../../MarkdownEditor';
import PlayerChartTable from '../PlayerChartTable';
import ContentsBox, { orderWithChildren } from '../../../ContentsBox';

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
  parent?: string;
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
  doc_first: boolean;
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

function PlayEntityPageInner() {
  const params = useParams<{ world: string; entity: string }>();
  const { world: worldSlug, entity: entitySlug } = params;
  const searchParams = useSearchParams();
  const viewAs = searchParams.get('as');

  const [world, setWorld] = useState<World | null>(null);
  const [entity, setEntity] = useState<PlayerEntity | null>(null);
  const [rels, setRels] = useState<PlayerRel[]>([]);
  const [assets, setAssets] = useState<PlayerAsset[]>([]);
  const [refNames, setRefNames] = useState<Map<string, RefName>>(new Map());
  const [linkedCharts, setLinkedCharts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);

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

    if (viewAs) {
      const { data: nm } = await supabase.rpc('hub_user_names', {
        p_ids: [viewAs],
      });
      setPreviewName(
        ((nm as { display_name: string }[]) ?? [])[0]?.display_name ?? null
      );
    }

    const { data: entRows, error: eErr } = await supabase.rpc(
      'ra_player_get_entity',
      { p_world_id: w.id, p_slug: entitySlug, p_view_as: viewAs }
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

    const [relsRes, assetsRes, chartsRes] = await Promise.all([
      supabase.rpc('ra_player_entity_relationships', {
        p_world_id: w.id,
        p_entity_id: e.id,
        p_view_as: viewAs,
      }),
      supabase.rpc('ra_player_entity_assets', {
        p_world_id: w.id,
        p_entity_id: e.id,
        p_view_as: viewAs,
      }),
      supabase.rpc('ra_player_entity_charts', {
        p_world_id: w.id,
        p_entity_id: e.id,
        p_view_as: viewAs,
      }),
    ]);

    if (!relsRes.error) setRels((relsRes.data as PlayerRel[]) ?? []);
    if (!assetsRes.error)
      setAssets((assetsRes.data as PlayerAsset[]) ?? []);
    if (!chartsRes.error)
      setLinkedCharts(
        (((chartsRes.data as { chart_id: string }[]) ?? []).map(
          (r) => r.chart_id
        ))
      );

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
        { p_world_id: w.id, p_ids: refIds, p_view_as: viewAs }
      );
      setRefNames(
        new Map(((resolved as RefName[]) ?? []).map((r) => [r.id, r]))
      );
    }

    setLoading(false);
  }, [worldSlug, entitySlug, viewAs]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const accent = world?.appearance?.accent || '#c8900a';

  const previewBanner = viewAs ? (
    <div className={styles.previewBanner}>
      <span>
        👁 Previewing as {previewName ?? 'player'} — this is exactly what
        they see.
      </span>
      <Link
        href={`/rpg-archive/${worldSlug}`}
        className={styles.previewExit}
      >
        Exit preview
      </Link>
    </div>
  ) : null;

  function refLink(id: string) {
    const r = refNames.get(id);
    if (!r) return <span key={id}>Unknown</span>;
    return (
      <Link
        key={id}
        href={`/rpg-archive/${worldSlug}/play/${r.slug}${
          viewAs ? `?as=${viewAs}` : ''
        }`}
        className={styles.inlineLink}
      >
        {r.name}
      </Link>
    );
  }

  function renderValue(f: FieldDefLite, v: unknown) {
    if (f.type === 'boolean') return v ? 'Yes' : 'No';
    if (f.type === 'markdown' && typeof v === 'string') {
      return (
        <MarkdownView
          source={v}
          wikiPrefix={`/rpg-archive/${worldSlug}/play`}
        />
      );
    }
    if (f.type === 'long_text' && typeof v === 'string') {
      return <span className={styles.preWrap}>{v}</span>;
    }
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
        {previewBanner}
        <div className={styles.empty}>
          <p>This knowledge has not been revealed to you.</p>
          <p className={styles.muted}>
            {error ?? 'Ask your GM — or discover it in play.'}
          </p>
        </div>
        <p style={{ marginTop: '1rem' }}>
          <Link
            href={`/rpg-archive/${worldSlug}/play${viewAs ? `?as=${viewAs}` : ''}`}
            className={styles.backLink}
          >
            ← Back to the archive
          </Link>
        </p>
      </div>
    );
  }

  const filledFields = orderWithChildren(
    (entity.fields ?? []).filter((f) => {
      const v = entity.data?.[f.key];
      if (v === undefined || v === null || v === '') return false;
      if (Array.isArray(v) && v.length === 0) return false;
      if (f.type === 'asset_ref') return false;
      return true;
    })
  );

  return (
    <div className={styles.wrap} style={{ ['--ra-accent' as string]: accent }}>
      <Link
        href={`/rpg-archive/${worldSlug}/play${viewAs ? `?as=${viewAs}` : ''}`}
        className={styles.backLink}
      >
        ← {world.name}
      </Link>

      {previewBanner}

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

      <ContentsBox
        fields={entity.fields ?? []}
        presentKeys={filledFields.map((f) => f.key)}
      />

      {(() => {
        const detailsSection = filledFields.length > 0 && (
          <section key="details" className={styles.section}>
            <h2 className={styles.sectionTitle}>Details</h2>
            <div className={styles.fieldGrid}>
              {filledFields.map((f) => (
                <div
                  key={f.key}
                  id={`field-${f.key}`}
                  className={`${styles.fieldRow} ${
                    f.type === 'markdown' || f.type === 'long_text'
                      ? styles.fieldRowWide
                      : ''
                  } ${f.parent ? styles.fieldRowSub : ''}`}
                >
                  <span className={styles.fieldLabel}>{f.label}</span>
                  <span className={styles.fieldValue}>
                    {renderValue(f, entity.data[f.key])}
                  </span>
                </div>
              ))}
            </div>
          </section>
        );
        const docSection = !!entity.doc?.trim() && (
          <section key="doc" className={styles.section}>
            <MarkdownView
              source={entity.doc}
              wikiPrefix={`/rpg-archive/${worldSlug}/play`}
            />
          </section>
        );
        return entity.doc_first
          ? [docSection, detailsSection]
          : [detailsSection, docSection];
      })()}

      {linkedCharts.map((cid) => (
        <section key={cid} className={styles.section}>
          <PlayerChartTable
            worldId={world.id}
            worldSlug={worldSlug}
            chartId={cid}
            viewAs={viewAs}
            embed
          />
        </section>
      ))}

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
                  href={`/rpg-archive/${worldSlug}/play/${r.other_slug}${
                    viewAs ? `?as=${viewAs}` : ''
                  }`}
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

export default function PlayEntityPage() {
  return (
    <Suspense fallback={<div />}>
      <PlayEntityPageInner />
    </Suspense>
  );
}
