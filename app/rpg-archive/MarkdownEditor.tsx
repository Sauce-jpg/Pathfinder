'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './markdown.module.css';

export function MarkdownView({ source }: { source: string }) {
  if (!source.trim()) {
    return <p className={styles.emptyNote}>Nothing written yet.</p>;
  }
  return (
    <div className={styles.md}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  );
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
};

export default function MarkdownEditor({
  value,
  onChange,
  rows = 12,
  placeholder,
}: Props) {
  const [mode, setMode] = useState<'write' | 'preview'>(
    value.trim() ? 'preview' : 'write'
  );

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
      </div>
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
          <MarkdownView source={value} />
        </div>
      )}
    </div>
  );
}
