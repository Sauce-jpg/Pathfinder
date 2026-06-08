'use client'

// app/lists/components/NoteModal.tsx

import { useState, useEffect } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import { Note, Project } from '../types'
import styles from './Modal.module.css'

type Props = {
  note: Note | null       // null = create mode
  projects: Project[]
  onClose: () => void
  onSave: () => void
  supabase: SupabaseClient
}

export default function NoteModal({ note, projects, onClose, onSave, supabase }: Props) {
  const [title, setTitle]         = useState(note?.title ?? '')
  const [body, setBody]           = useState(note?.body ?? '')
  const [tagInput, setTagInput]   = useState(note?.tags.join(', ') ?? '')
  const [projectId, setProjectId] = useState(note?.project_id ?? '')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    // Focus title on open
    document.getElementById('note-title')?.focus()
  }, [])

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError('')

    const tags = tagInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)

    // Get session — works with both auth-helpers and plain createClient
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Not logged in — please refresh the page'); setSaving(false); return }

    const user = session.user

    const payload = {
      title: title.trim(),
      body: body.trim() || null,
      tags,
      project_id: projectId || null,
    }

    const { error: dbError } = note
      ? await supabase.from('notes').update(payload).eq('id', note.id)
      : await supabase.from('notes').insert({ ...payload, user_id: user.id })

    setSaving(false)
    if (dbError) { setError(dbError.message); return }
    onSave()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title" onKeyDown={handleKeyDown}>

        <div className={styles.modalHeader}>
          <h2 id="modal-title" className={styles.modalTitle}>
            {note ? 'Edit note' : 'New note'}
          </h2>
          <button onClick={onClose} aria-label="Close" className={styles.closeBtn}>
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div className={styles.modalBody}>
          <label className={styles.label} htmlFor="note-title">Title</label>
          <input
            id="note-title"
            className={styles.input}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Note title"
          />

          <label className={styles.label} htmlFor="note-body">Body</label>
          <textarea
            id="note-body"
            className={styles.textarea}
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Write anything…"
            rows={6}
          />

          <label className={styles.label} htmlFor="note-tags">Tags</label>
          <input
            id="note-tags"
            className={styles.input}
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            placeholder="website, ideas, gear  (comma separated)"
          />

          {projects.length > 0 && (
            <>
              <label className={styles.label} htmlFor="note-project">Project</label>
              <select
                id="note-project"
                className={styles.select}
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
              >
                <option value="">No project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </>
          )}

          {error && <p className={styles.error}>{error}</p>}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save note'}
          </button>
        </div>
      </div>
    </div>
  )
}
