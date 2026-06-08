'use client'

// app/lists/components/NoteCard.tsx

import { SupabaseClient } from '@supabase/supabase-js'
import { Note } from '../types'
import styles from './NoteCard.module.css'

type Props = {
  note: Note
  onEdit: () => void
  onRefresh: () => void
  supabase: SupabaseClient
}

export default function NoteCard({ note, onEdit, onRefresh, supabase }: Props) {
  const handlePin = async () => {
    await supabase.from('notes').update({ pinned: !note.pinned }).eq('id', note.id)
    onRefresh()
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${note.title}"?`)) return
    await supabase.from('notes').delete().eq('id', note.id)
    onRefresh()
  }

  return (
    <article className={`${styles.card} ${note.pinned ? styles.pinned : ''}`}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>{note.title}</h3>
        <div className={styles.actions}>
          <button
            onClick={handlePin}
            aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
            className={`${styles.iconBtn} ${note.pinned ? styles.iconBtnActive : ''}`}
          >
            <i className="ti ti-pin" aria-hidden="true" />
          </button>
          <button onClick={onEdit} aria-label="Edit note" className={styles.iconBtn}>
            <i className="ti ti-edit" aria-hidden="true" />
          </button>
          <button onClick={handleDelete} aria-label="Delete note" className={styles.iconBtn}>
            <i className="ti ti-trash" aria-hidden="true" />
          </button>
        </div>
      </div>

      {note.body && (
        <p className={styles.body}>{note.body.slice(0, 160)}{note.body.length > 160 ? '…' : ''}</p>
      )}

      {note.tags.length > 0 && (
        <div className={styles.tags}>
          {note.tags.map(tag => (
            <span key={tag} className={styles.tag}>{tag}</span>
          ))}
        </div>
      )}

      <time className={styles.date} dateTime={note.updated_at}>
        {new Date(note.updated_at).toLocaleDateString('sv-SE')}
      </time>
    </article>
  )
}
