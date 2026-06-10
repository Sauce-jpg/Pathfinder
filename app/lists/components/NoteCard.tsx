'use client'

import { SupabaseClient } from '@supabase/supabase-js'
import { Note, Project } from '../types'
import styles from './NoteCard.module.css'

type Props = {
  note: Note
  projects: Project[]
  onEdit: () => void
  onRefresh: () => void
  supabase: SupabaseClient
}

export default function NoteCard({ note, projects, onEdit, onRefresh, supabase }: Props) {
  const handlePin = async () => {
    await supabase.from('notes').update({ pinned: !note.pinned }).eq('id', note.id)
    onRefresh()
  }

  const handleBacklog = async () => {
    await supabase.from('notes').update({ in_backlog: !note.in_backlog }).eq('id', note.id)
    onRefresh()
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${note.title}"?`)) return
    await supabase.from('notes').delete().eq('id', note.id)
    onRefresh()
  }

  const project = projects.find(p => p.id === note.project_id)

  return (
    <article className={`${styles.card} ${note.pinned ? styles.pinned : ''} ${note.in_backlog ? styles.inBacklog : ''}`}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>{note.title}</h3>
        <div className={styles.actions}>
          <button
            onClick={handlePin}
            aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
            title={note.pinned ? 'Unpin note' : 'Pin note'}
            className={`${styles.iconBtn} ${note.pinned ? styles.iconBtnActive : ''}`}
          >
            <i className="ti ti-pin" aria-hidden="true" />
          </button>
          <button
            onClick={handleBacklog}
            aria-label={note.in_backlog ? 'Remove from backlog' : 'Add to backlog'}
            title={note.in_backlog ? 'Remove from backlog' : 'Add to backlog'}
            className={`${styles.iconBtn} ${note.in_backlog ? styles.iconBtnActive : ''}`}
          >
            <i className="ti ti-stack-2" aria-hidden="true" />
          </button>
          <button onClick={onEdit} aria-label="Edit note" title="Edit note" className={styles.iconBtn}>
            <i className="ti ti-edit" aria-hidden="true" />
          </button>
          <button onClick={handleDelete} aria-label="Delete note" title="Delete note" className={`${styles.iconBtn} ${styles.iconBtnDanger}`}>
            <i className="ti ti-trash" aria-hidden="true" />
          </button>
        </div>
      </div>

      {project && (
        <span className={styles.projectBadge}>
          <i className="ti ti-layout-grid" aria-hidden="true" />
          {project.title}
        </span>
      )}

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
