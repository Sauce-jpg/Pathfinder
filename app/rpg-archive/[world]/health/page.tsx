'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from './health.module.css';

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
  required: boolean;
};

type EntityTypeRow = {
  id: string;
  display_name: string;
  icon: string | null;
  fields: FieldDefLite[];
};

type EntityRow = {
  id: string;
  name: string;
  slug: string;
  entity_type_id: string;
  status: string;
  data: Record<string, unknown>;
  doc: string;
};

type RelRow = { source_id: string; target_id: string };
type AssetRow = { id: string; name: string };

type Issue = {
  key: string;
  entityName: string;
  entitySlug: string;
  detail: string;
};

export default function ArchiveHealthPage() {
  const params = useParams<{ world: string }>();
  const worldSlug = params.world;

  const [world, setWorld] = useState<World | null>(null);
  const [types, setTypes] = useState<EntityTypeRow[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [rels, setRels] = useState<RelRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [usedAssetIds, setUsedAssetIds] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState({
    campaigns: 0,
    sessions: 0,
    quests: 0,
  });
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
      setError(wErr?.message ?? 'World not found.');
      setLoading(false);
      return;
    }
    setWorld(w as World);

    const [
      typesRes,
      entsRes,
      relsRes,
      assetsRes,
      refsRes,
      campCount,
      sessCount,
      questCount,
    ] = await Promise.all([
      supabase
        .from('ra_entity_types')
        .select('id, display_name, icon, fields')
        .eq('world_id', w.id),
      supabase
        .from('ra_entities')
        .select('id, name, slug, entity_type_id, status, data, doc')
        .eq('world_id', w.id),
      supabase
        .from('ra_relationships')
        .select('source_id, target_id')
        .eq('world_id', w.id),
      supabase.from('ra_assets').select('id, name').eq('world_id', w.id),
      supabase
        .from('ra_entity_assets')
        .select('asset_id')
        .eq('world_id', w.id),
      supabase
        .from('ra_campaigns')
        .select('id', { count: 'exact', head: true })
        .eq('world_id', w.id),
      supabase
        .from('ra_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('world_id', w.id),
      supabase
        .from('ra_quests')
        .select('id', { count: 'exact', head: true })
        .eq('world_id', w.id),
    ]);

    if (typesRes.error) setError(typesRes.error.message);
    else setTypes((typesRes.data as EntityTypeRow[]) ?? []);

    if (entsRes.error) setError(entsRes.error.message);
    else setEntities((entsRes.data as EntityRow[]) ?? []);

    if (relsRes.error) setError(relsRes.error.message);
    else setRels((relsRes.data as RelRow[]) ?? []);

    if (assetsRes.error) setError(assetsRes.error.message);
    else setAssets((assetsRes.data as AssetRow[]) ?? []);

    if (!refsRes.error) {
      setUsedAssetIds(
        new Set(
          ((refsRes.data as { asset_id: string }[]) ?? []).map(
            (r) => r.asset_id
          )
        )
      );
    }

    setCounts({
      campaigns: campCount.count ?? 0,
      sessions: sessCount.count ?? 0,
      quests: questCount.count ?? 0,
    });

    setLoading(false);
  }, [worldSlug]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const accent = world?.appearance?.accent || '#c8900a';

  const report = useMemo(() => {
    const fieldsByType = new Map(types.map((t) => [t.id, t.fields ?? []]));
    const live = entities.filter((e) => e.status !== 'deleted');
    const binned = entities.length - live.length;
    const liveIds = new Set(live.map((e) => e.id));
    const assetIds = new Set(assets.map((a) => a.id));

    const connected = new Set<string>();
    for (const r of rels) {
      connected.add(r.source_id);
      connected.add(r.target_id);
    }

    const drafts: Issue[] = [];
    const deadLinks: Issue[] = [];
    const slugSet = new Set(live.map((e) => e.slug));
    const slugifyWiki = (input: string) =>
      input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    const missingRequired: Issue[] = [];
    const brokenRefs: Issue[] = [];
    const orphans: Issue[] = [];
    const noDoc: Issue[] = [];

    for (const e of live) {
      if (e.status === 'draft') {
        drafts.push({
          key: `draft-${e.id}`,
          entityName: e.name,
          entitySlug: e.slug,
          detail: 'still a draft',
        });
      }

      const fields = fieldsByType.get(e.entity_type_id) ?? [];
      const data = e.data ?? {};

      for (const f of fields) {
        const v = data[f.key];
        const empty =
          v === undefined ||
          v === null ||
          v === '' ||
          (Array.isArray(v) && v.length === 0);
        if (f.required && empty) {
          missingRequired.push({
            key: `req-${e.id}-${f.key}`,
            entityName: e.name,
            entitySlug: e.slug,
            detail: `required field "${f.label}" is empty`,
          });
        }
        if (f.type === 'entity_ref') {
          const refs = Array.isArray(v)
            ? (v as string[])
            : typeof v === 'string' && v
            ? [v]
            : [];
          refs.forEach((rv, ri) => {
            if (!liveIds.has(rv)) {
              brokenRefs.push({
                key: `eref-${e.id}-${f.key}-${ri}`,
                entityName: e.name,
                entitySlug: e.slug,
                detail: `"${f.label}" points to a missing or recycled entity`,
              });
            }
          });
        }
        if (f.type === 'asset_ref') {
          const refs = Array.isArray(v)
            ? (v as string[])
            : typeof v === 'string' && v
            ? [v]
            : [];
          refs.forEach((rv, ri) => {
            if (!assetIds.has(rv)) {
              brokenRefs.push({
                key: `aref-${e.id}-${f.key}-${ri}`,
                entityName: e.name,
                entitySlug: e.slug,
                detail: `"${f.label}" points to a missing asset`,
              });
            }
          });
        }
      }

      if (!connected.has(e.id)) {
        orphans.push({
          key: `orphan-${e.id}`,
          entityName: e.name,
          entitySlug: e.slug,
          detail: 'no relationships in or out',
        });
      }

      if (!e.doc?.trim()) {
        noDoc.push({
          key: `doc-${e.id}`,
          entityName: e.name,
          entitySlug: e.slug,
          detail: 'no documentation written',
        });
      }
    }

    const unusedAssets = assets.filter((a) => !usedAssetIds.has(a.id));

    // Dead wiki links: [[Name]] targets with no matching entity slug.
    const wikiRe = /\[\[([^\[\]|]+?)(?:\|[^\[\]]*?)?\]\]/g;
    for (const e of live) {
      const texts: string[] = [e.doc ?? ''];
      for (const val of Object.values(e.data ?? {})) {
        if (typeof val === 'string') texts.push(val);
      }
      const seen = new Set<string>();
      for (const text of texts) {
        for (const m of text.matchAll(wikiRe)) {
          const target = m[1].trim();
          const slug = slugifyWiki(target);
          if (!slug || slugSet.has(slug) || seen.has(slug)) continue;
          seen.add(slug);
          deadLinks.push({
            key: `${e.id}-wiki-${slug}`,
            entityName: e.name,
            entitySlug: e.slug,
            detail: `[[${target}]] → no entity "${slug}"`,
          });
        }
      }
    }

    return {
      live,
      binned,
      drafts,
      missingRequired,
      brokenRefs,
      orphans,
      noDoc,
      deadLinks,
      unusedAssets,
      relCount: rels.length,
    };
  }, [types, entities, rels, assets, usedAssetIds]);

  if (loading) {
    return (
      <div className={styles.wrap}>
        <p className={styles.muted}>Checking archive health…</p>
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

  const warningCount =
    report.missingRequired.length +
    report.brokenRefs.length +
    report.deadLinks.length;
  const healthy =
    warningCount === 0 &&
    report.drafts.length === 0 &&
    report.orphans.length === 0 &&
    report.noDoc.length === 0 &&
    report.unusedAssets.length === 0;

  const issueSection = (
    title: string,
    issues: Issue[],
    warning: boolean,
    hint: string
  ) => {
    if (issues.length === 0) return null;
    return (
      <section className={styles.group}>
        <h2 className={warning ? styles.groupTitleWarn : styles.groupTitle}>
          {title} ({issues.length})
        </h2>
        <p className={styles.hint}>{hint}</p>
        {issues.map((i) => (
          <Link
            key={i.key}
            href={`/rpg-archive/${worldSlug}/archive/${i.entitySlug}`}
            className={styles.row}
          >
            <span className={styles.rowName}>{i.entityName}</span>
            <span className={styles.rowDetail}>{i.detail}</span>
          </Link>
        ))}
      </section>
    );
  };

  return (
    <div className={styles.wrap} style={{ ['--ra-accent' as string]: accent }}>
      <Link
        href={`/rpg-archive/${worldSlug}/archive`}
        className={styles.backLink}
      >
        ← Archive
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>Archive Health</h1>
        <p className={styles.subtitle}>
          A quality report for {world.name}.
        </p>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.statsGrid}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{report.live.length}</span>
          <span className={styles.statLabel}>
            Entities{report.binned > 0 ? ` (+${report.binned} in bin)` : ''}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{report.relCount}</span>
          <span className={styles.statLabel}>Relationships</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{assets.length}</span>
          <span className={styles.statLabel}>Assets</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{counts.campaigns}</span>
          <span className={styles.statLabel}>Campaigns</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{counts.sessions}</span>
          <span className={styles.statLabel}>Sessions</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{counts.quests}</span>
          <span className={styles.statLabel}>Quests</span>
        </div>
      </div>

      {healthy ? (
        <div className={styles.healthy}>
          <p>✦ The Archive is in perfect health.</p>
          <p className={styles.muted}>
            No drafts, no missing fields, no broken references, no orphans,
            no unused assets.
          </p>
        </div>
      ) : (
        <>
          {issueSection(
            'Broken References',
            report.brokenRefs,
            true,
            'Field values pointing at entities or assets that no longer exist. Open the entity and fix or clear the field.'
          )}
          {issueSection(
            'Missing Required Fields',
            report.missingRequired,
            true,
            'These entities have empty required fields, which will block publishing.'
          )}
          {issueSection(
            'Dead Wiki Links',
            report.deadLinks,
            true,
            'Markdown [[links]] pointing at names with no matching entity. Fix the spelling, or create the entity.'
          )}
          {issueSection(
            'Drafts',
            report.drafts,
            false,
            'Entities still in draft. Fine while working — just a reminder they exist.'
          )}
          {issueSection(
            'Unconnected Entities',
            report.orphans,
            false,
            'No relationships in or out. Knowledge becomes valuable through connections.'
          )}
          {issueSection(
            'Missing Documentation',
            report.noDoc,
            false,
            'Structured data only, no written lore yet.'
          )}
          {report.unusedAssets.length > 0 && (
            <section className={styles.group}>
              <h2 className={styles.groupTitle}>
                Unused Assets ({report.unusedAssets.length})
              </h2>
              <p className={styles.hint}>
                Uploaded but not linked to any entity. Not a problem — just
                inventory awareness.
              </p>
              {report.unusedAssets.map((a) => (
                <Link
                  key={a.id}
                  href={`/rpg-archive/${worldSlug}/assets`}
                  className={styles.row}
                >
                  <span className={styles.rowName}>{a.name}</span>
                  <span className={styles.rowDetail}>in the asset library</span>
                </Link>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
