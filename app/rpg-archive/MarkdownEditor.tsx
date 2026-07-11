'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import styles from './markdown.module.css';

function slugifyWiki(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Turns [[Entity Name]] and [[Entity Name|display text]] into markdown
 * links. Slugs are derived from names with the same rule used at entity
 * creation, so no lookup is needed.
 */
function applyWikiLinks(source: string, prefix: string): string {
  return source.replace(
    /\[\[([^\[\]|]+?)(?:\|([^\[\]]+?))?\]\]/g,
    (_m, target: string, display?: string) =>
      `[${(display ?? target).trim()}](${prefix}/${slugifyWiki(target)})`
  );
}

export function MarkdownView({
  source,
  wikiPrefix,
}: {
  source: string;
  wikiPrefix?: string;
}) {
  if (!source.trim()) {
    return <p className={styles.emptyNote}>Nothing written yet.</p>;
  }
  const processed = wikiPrefix
    ? applyWikiLinks(source, wikiPrefix)
    : source;
  return (
    <div className={styles.md}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
        {processed}
      </ReactMarkdown>
    </div>
  );
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  wikiPrefix?: string;
};

export default function MarkdownEditor({
  value,
  onChange,
  rows = 12,
  placeholder,
  wikiPrefix,
}: Props) {
  const [mode, setMode] = useState<'write' | 'preview'>(
    value.trim() ? 'preview' : 'write'
  );
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className={styles.editorWrap}>
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${
            mode === 'write' ? styles.tabActive : ''
          }`}
          onClick={() => setMode('write')}
        >
          Write
        </button>
        <button
          type="button"
          className={`${styles.tab} ${
            mode === 'preview' ? styles.tabActive : ''
          }`}
          onClick={() => setMode('preview')}
        >
          Preview
        </button>
        <button
          type="button"
          className={`${styles.tab} ${styles.helpTab} ${
            showHelp ? styles.tabActive : ''
          }`}
          onClick={() => setShowHelp((v) => !v)}
          title="Formatting help"
        >
          ?
        </button>
      </div>
      {showHelp && (
        <div className={styles.helpBox}>
          <span>
            <code>## Heading</code> · <code>### Smaller</code>
          </span>
          <span>
            <code>**bold**</code> · <code>*italic*</code>
          </span>
          <span>
            <code>[[Entity Name]]</code> links to that entity
          </span>
          <span>
            <code>[[Entity Name|shown text]]</code> custom label
          </span>
          <span>
            <code>- item</code> lists · <code>&gt; quote</code> ·{' '}
            <code>---</code> divider
          </span>
        </div>
      )}
      {mode === 'write' ? (
        <textarea
          className={styles.area}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <div className={styles.previewBox} style={{ minHeight: rows * 1.4 + 'em' }}>
          <MarkdownView source={value} wikiPrefix={wikiPrefix} />
        </div>
      )}
    </div>
  );
}
