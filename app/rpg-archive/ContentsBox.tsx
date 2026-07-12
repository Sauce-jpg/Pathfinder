'use client';

import { useState } from 'react';
import styles from './toc.module.css';

export type TocField = {
  key: string;
  label: string;
  type: string;
  parent?: string;
};

/**
 * Returns fields reordered so markdown sub-sections follow their parent
 * chapter. Non-markdown fields and orphans (parent missing or not
 * markdown) keep their original position.
 */
export function orderWithChildren<T extends TocField>(fields: T[]): T[] {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const isChild = (f: T) =>
    f.type === 'markdown' &&
    !!f.parent &&
    byKey.get(f.parent)?.type === 'markdown';

  const out: T[] = [];
  for (const f of fields) {
    if (isChild(f)) continue;
    out.push(f);
    if (f.type === 'markdown') {
      for (const c of fields) {
        if (isChild(c) && c.parent === f.key) out.push(c);
      }
    }
  }
  return out;
}

type Props = {
  fields: TocField[];
  /** When given (player view), only these field keys are listed. */
  presentKeys?: string[];
};

export default function ContentsBox({ fields, presentKeys }: Props) {
  const [hidden, setHidden] = useState(false);

  const present = presentKeys ? new Set(presentKeys) : null;
  const md = fields.filter(
    (f) => f.type === 'markdown' && (!present || present.has(f.key))
  );
  const mdKeys = new Set(md.map((f) => f.key));
  // A chapter whose parent isn't visible promotes to top level.
  const tops = md.filter((f) => !f.parent || !mdKeys.has(f.parent));
  const childrenOf = (key: string) => md.filter((f) => f.parent === key);

  if (md.length < 2) return null;

  return (
    <nav className={styles.toc}>
      <div className={styles.tocHeader}>
        <span className={styles.tocTitle}>☰ Contents</span>
        <button
          className={styles.tocToggle}
          onClick={() => setHidden((v) => !v)}
        >
          [{hidden ? 'show' : 'hide'}]
        </button>
      </div>
      {!hidden && (
        <ol className={styles.tocList}>
          {tops.map((f, i) => {
            const kids = childrenOf(f.key);
            return (
              <li key={f.key}>
                <a href={`#field-${f.key}`} className={styles.tocLink}>
                  <span className={styles.tocNum}>{i + 1}.</span>
                  {f.label}
                </a>
                {kids.length > 0 && (
                  <ol className={styles.tocSubList}>
                    {kids.map((c, j) => (
                      <li key={c.key}>
                        <a
                          href={`#field-${c.key}`}
                          className={styles.tocLink}
                        >
                          <span className={styles.tocNum}>
                            {i + 1}.{j + 1}.
                          </span>
                          {c.label}
                        </a>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </nav>
  );
}
