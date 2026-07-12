'use client';

import Link from 'next/link';
import styles from './tree.module.css';

export type TreeNodeData = {
  id: string;
  label: string;
  icon?: string | null;
  href: string;
  meta?: string;
};

type Edge = { parent: string; child: string };

type Props = {
  nodes: TreeNodeData[];
  edges: Edge[];
};

const MAX_DEPTH = 12;

export default function TreeView({ nodes, edges }: Props) {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const childrenMap = new Map<string, string[]>();
  const hasParent = new Set<string>();
  const connected = new Set<string>();

  for (const e of edges) {
    if (!nodeById.has(e.parent) || !nodeById.has(e.child)) continue;
    connected.add(e.parent);
    connected.add(e.child);
    hasParent.add(e.child);
    childrenMap.set(e.parent, [
      ...(childrenMap.get(e.parent) ?? []),
      e.child,
    ]);
  }

  const byLabel = (a: string, b: string) =>
    (nodeById.get(a)?.label ?? '').localeCompare(nodeById.get(b)?.label ?? '');

  let roots = nodes
    .filter((n) => connected.has(n.id) && !hasParent.has(n.id))
    .map((n) => n.id)
    .sort(byLabel);

  // Pure-cycle fallback: nothing lacks a parent, so start anywhere.
  if (roots.length === 0 && connected.size > 0) {
    roots = [Array.from(connected).sort(byLabel)[0]];
  }

  if (connected.size === 0) {
    return (
      <p className={styles.emptyNote}>
        No connections of this relationship type yet.
      </p>
    );
  }

  function renderNode(id: string, depth: number, path: Set<string>) {
    const node = nodeById.get(id);
    if (!node) return null;

    const kids = (childrenMap.get(id) ?? [])
      .filter((k) => !path.has(k))
      .sort(byLabel);

    const row = (
      <span className={styles.nodeRow}>
        <span className={styles.nodeIcon}>{node.icon || '◆'}</span>
        <Link href={node.href} className={styles.nodeLink}>
          {node.label}
        </Link>
        {node.meta && <span className={styles.nodeMeta}>{node.meta}</span>}
        {kids.length > 0 && (
          <span className={styles.nodeCount}>{kids.length}</span>
        )}
      </span>
    );

    if (kids.length === 0 || depth >= MAX_DEPTH) {
      return (
        <div key={id} className={styles.leaf}>
          {row}
        </div>
      );
    }

    const nextPath = new Set(path);
    nextPath.add(id);

    return (
      <details key={id} className={styles.branch} open={depth < 2}>
        <summary className={styles.summary}>{row}</summary>
        <div className={styles.children}>
          {kids.map((k) => renderNode(k, depth + 1, nextPath))}
        </div>
      </details>
    );
  }

  return (
    <div className={styles.tree}>
      {roots.map((r) => renderNode(r, 0, new Set()))}
    </div>
  );
}
