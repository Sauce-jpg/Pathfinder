'use client'

// app/lists/components/SimpleCreateModal.tsx
// A minimal single-field modal used for creating todo lists, purchase lists, etc.

import { useState, useEffect } from 'react'
import styles from './Modal.module.css'

type Props = {
  title: string
  placeholder: string
  onClose: () => void
  onSave: (title: string) => Promise<void>
}

export default function SimpleCreateModal({ title, placeholder, onClose, onSave }: Props) {
  const [value, setValue]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => {
    document.getElementById('simple-create-input')?.focus()
  }, [])

  const handleSave = async () => {
    if (!value.trim()) { setError('Please enter a name'); return }
    setSaving(true)
    await onSave(value.trim())
    setSaving(false)
  }

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title">

        <div className={styles.modalHeader}>
          <h2 id="modal-title" className={styles.modalTitle}>{title}</h2>
          <button onClick={onClose} aria-label="Close" className={styles.closeBtn}>
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div className={styles.modalBody}>
          <label className={styles.label} htmlFor="simple-create-input">Name</label>
          <input
            id="simple-create-input"
            className={styles.input}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose() }}
            placeholder={placeholder}
          />
          {error && <p className={styles.error}>{error}</p>}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
