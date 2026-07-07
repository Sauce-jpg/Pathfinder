'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import styles from './graph.module.css';

type World = {
  id: string;
  name: string;
  slug: string;
  appearance: { accent?: string };
};

type EntityTypeRow = {
  id: string;
  display_name: string;
  icon: string | null;
  color: string | null;
};

type EntityRow = {
  id: string;
  name: string;
  slug: string;
  entity_type_id: string;
};

type RelRow = {
  id: string;
  source_id: string;
  target_id: string;
  relationship_type_id: string;
  status: string;
};

type RelTypeRow = {
  id: string;
  display_name: string;
};

type SimNode = {
  id: string;
  name: string;
  slug: string;
  typeId: string;
  degree: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
};

type SimEdge = {
  s: number;
  t: number;
  label: string;
  active: boolean;
};

export default function GraphPage() {
  const params = useParams<{ world: string }>();
  const worldSlug = params.world;
  const router = useRouter();

  const [world, setWorld] = useState<World | null>(null);
  const [types, setTypes] = useState<EntityTypeRow[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [rels, setRels] = useState<RelRow[]>([]);
  const [relTypes, setRelTypes] = useState<RelTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [hoverId, setHoverId] = useState<string | null>(null);

  const simRef = useRef<{ nodes: SimNode[]; edges: SimEdge[] }>({
    nodes: [],
    edges: [],
  });
  const alphaRef = useRef(1);
  const [, setFrame] = useState(0);

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

    const [typesRes, entsRes, relsRes, relTypesRes] = await Promise.all([
      supabase
        .from('ra_entity_types')
        .select('id, display_name, icon, color')
        .eq('world_id', w.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('ra_entities')
        .select('id, name, slug, entity_type_id')
        .eq('world_id', w.id)
        .neq('status', 'deleted'),
      supabase
        .from('ra_relationships')
        .select('id, source_id, target_id, relationship_type_id, status')
        .eq('world_id', w.id),
      supabase
        .from('ra_relationship_types')
        .select('id, display_name')
        .eq('world_id', w.id),
    ]);

    if (typesRes.error) setError(typesRes.error.message);
    else setTypes((typesRes.data as EntityTypeRow[]) ?? []);

    if (entsRes.error) setError(entsRes.error.message);
    else setEntities((entsRes.data as EntityRow[]) ?? []);

    if (relsRes.error) setError(relsRes.error.message);
    else setRels((relsRes.data as RelRow[]) ?? []);

    if (relTypesRes.error) setError(relTypesRes.error.message);
    else setRelTypes((relTypesRes.data as RelTypeRow[]) ?? []);

    setLoading(false);
  }, [worldSlug]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Build the simulation and run it whenever the data or the filter changes.
  useEffect(() => {
    const relTypeName = new Map(relTypes.map((t) => [t.id, t.display_name]));

    const visible = entities.filter((e) => !hiddenTypes.has(e.entity_type_id));
    const index = new Map(visible.map((e, i) => [e.id, i]));

    const degree = new Map<string, number>();
    const edges: SimEdge[] = [];
    for (const r of rels) {
      const s = index.get(r.source_id);
      const t = index.get(r.target_id);
      if (s === undefined || t === undefined) continue;
      edges.push({
        s,
        t,
        label: relTypeName.get(r.relationship_type_id) ?? 'related',
        active: r.status === 'active',
      });
      degree.set(r.source_id, (degree.get(r.source_id) ?? 0) + 1);
      degree.set(r.target_id, (degree.get(r.target_id) ?? 0) + 1);
    }

    const n = visible.length;
    const radius = 80 + n * 6;
    const nodes: SimNode[] = visible.map((e, i) => ({
      id: e.id,
      name: e.name,
      slug: e.slug,
      typeId: e.entity_type_id,
      degree: degree.get(e.id) ?? 0,
      x: radius * Math.cos((2 * Math.PI * i) / Math.max(n, 1)),
      y: radius * Math.sin((2 * Math.PI * i) / Math.max(n, 1)),
      vx: 0,
      vy: 0,
    }));

    simRef.current = { nodes, edges };
    alphaRef.current = 1;

    let raf = 0;
    const tick = () => {
      const { nodes, edges } = simRef.current;
      const a = alphaRef.current;

      // Pairwise repulsion (O(n²): fine up to a few hundred nodes).
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const ni = nodes[i];
          const nj = nodes[j];
          let dx = ni.x - nj.x;
          let dy = ni.y - nj.y;
          const d2 = Math.max(dx * dx + dy * dy, 25);
          const f = (2600 / d2) * a;
          const d = Math.sqrt(d2);
          dx /= d;
          dy /= d;
          ni.vx += dx * f;
          ni.vy += dy * f;
          nj.vx -= dx * f;
          nj.vy -= dy * f;
        }
      }

      // Springs along relationships.
      for (const e of edges) {
        const s = nodes[e.s];
        const t = nodes[e.t];
        let dx = t.x - s.x;
        let dy = t.y - s.y;
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const f = (d - 110) * 0.05 * a;
        dx /= d;
        dy /= d;
        s.vx += dx * f;
        s.vy += dy * f;
        t.vx -= dx * f;
        t.vy -= dy * f;
      }

      // Gentle gravity toward the center, then integrate.
      for (const node of nodes) {
        node.vx += -node.x * 0.02 * a;
        node.vy += -node.y * 0.02 * a;
        node.vx *= 0.85;
        node.vy *= 0.85;
        node.x += node.vx;
        node.y += node.vy;
      }

      alphaRef.current *= 0.99;
      setFrame((f) => f + 1);
      if (alphaRef.current > 0.004) {
        raf = requestAnimationFrame(tick);
      }
    };

    if (nodes.length > 0) raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [entities, rels, relTypes, hiddenTypes]);

  const accent = world?.appearance?.accent || '#c8900a';
  const typeById = new Map(types.map((t) => [t.id, t]));

  function toggleType(id: string) {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setHoverId(null);
  }

  const { nodes, edges } = simRef.current;

  // Neighbor set for hover highlighting.
  const neighborIds = new Set<string>();
  if (hoverId) {
    const hi = nodes.findIndex((node) => node.id === hoverId);
    for (const e of edges) {
      if (e.s === hi) neighborIds.add(nodes[e.t].id);
      if (e.t === hi) neighborIds.add(nodes[e.s].id);
    }
  }

  // Fit the viewBox to the node extents.
  let viewBox = '-200 -150 400 300';
  if (nodes.length > 0) {
    const xs = nodes.map((node) => node.x);
    const ys = nodes.map((node) => node.y);
    const pad = 70;
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    const w = Math.max(...xs) - minX + pad;
    const h = Math.max(...ys) - minY + pad;
    viewBox = `${minX} ${minY} ${w} ${h}`;
  }

  const showAllLabels = nodes.length <= 60;

  if (loading) {
    return (
      <div className={styles.wrap}>
        <p className={styles.muted}>Loading graph…</p>
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
        <h1 className={styles.title}>Knowledge Graph</h1>
        <p className={styles.subtitle}>
          {entities.length} entities · {rels.length} relationships. Hover to
          trace connections, click to open an entity.
        </p>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.pillRow}>
        {types.map((t) => {
          const count = entities.filter(
            (e) => e.entity_type_id === t.id
          ).length;
          if (count === 0) return null;
          const hidden = hiddenTypes.has(t.id);
          return (
            <button
              key={t.id}
              className={`${styles.pill} ${hidden ? styles.pillOff : ''}`}
              onClick={() => toggleType(t.id)}
              title={hidden ? 'Show in graph' : 'Hide from graph'}
            >
              <span
                className={styles.dot}
                style={{ background: t.color || accent }}
              />
              {t.display_name} ({count})
            </button>
          );
        })}
      </div>

      {nodes.length === 0 ? (
        <div className={styles.empty}>
          <p>Nothing to draw.</p>
          <p className={styles.muted}>
            Create entities and connect them with relationships — the graph
            grows from there.
          </p>
        </div>
      ) : (
        <div className={styles.svgBox}>
          <svg viewBox={viewBox} className={styles.svg}>
            {edges.map((e, i) => {
              const s = nodes[e.s];
              const t = nodes[e.t];
              const involved =
                hoverId !== null &&
                (s.id === hoverId || t.id === hoverId);
              const dimmed = hoverId !== null && !involved;
              return (
                <line
                  key={i}
                  x1={s.x}
                  y1={s.y}
                  x2={t.x}
                  y2={t.y}
                  stroke={involved ? accent : '#d8d0c4'}
                  strokeWidth={involved ? 2 : 1.2}
                  strokeDasharray={e.active ? undefined : '4 3'}
                  opacity={dimmed ? 0.25 : 1}
                >
                  <title>{`${s.name} — ${e.label} → ${t.name}`}</title>
                </line>
              );
            })}
            {nodes.map((node) => {
              const t = typeById.get(node.typeId);
              const r = Math.min(6 + 2 * Math.sqrt(node.degree), 16);
              const isHover = node.id === hoverId;
              const isNeighbor = neighborIds.has(node.id);
              const dimmed = hoverId !== null && !isHover && !isNeighbor;
              const showLabel =
                showAllLabels || isHover || isNeighbor;
              return (
                <g
                  key={node.id}
                  opacity={dimmed ? 0.3 : 1}
                  onMouseEnter={() => setHoverId(node.id)}
                  onMouseLeave={() => setHoverId(null)}
                  onClick={() =>
                    router.push(
                      `/rpg-archive/${worldSlug}/archive/${node.slug}`
                    )
                  }
                  className={styles.node}
                >
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r}
                    fill={t?.color || accent}
                    stroke="#fffdf9"
                    strokeWidth={isHover ? 3 : 1.5}
                  />
                  {showLabel && (
                    <text
                      x={node.x}
                      y={node.y + r + 12}
                      textAnchor="middle"
                      className={styles.label}
                    >
                      {node.name}
                    </text>
                  )}
                  <title>{`${node.name} (${
                    t?.display_name ?? 'Entity'
                  }) · ${node.degree} connection${
                    node.degree === 1 ? '' : 's'
                  }`}</title>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      <p className={styles.mutedSmall}>
        Node size reflects connection count. Dashed lines are former or
        historical relationships.
      </p>
    </div>
  );
}
