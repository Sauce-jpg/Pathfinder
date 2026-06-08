'use client'

// app/lists/components/PurchaseItemModal.tsx

import { useState, useEffect } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import { PurchaseItem, PurchaseStatus, PurchasePriority, DesireTier } from '../types'
import styles from './Modal.module.css'

type Props = {
  item: PurchaseItem | null
  listId: string
  onClose: () => void
  onSave: () => void
  supabase: SupabaseClient
}

export default function PurchaseItemModal({ item, listId, onClose, onSave, supabase }: Props) {
  const [title, setTitle]             = useState(item?.title ?? '')
  const [url, setUrl]                 = useState(item?.url ?? '')
  const [price, setPrice]             = useState(item?.price?.toString() ?? '')
  const [targetPrice, setTargetPrice] = useState(item?.target_price?.toString() ?? '')
  const [status, setStatus]           = useState<PurchaseStatus>(item?.status ?? 'considering')
  const [priority, setPriority]       = useState<PurchasePriority>(item?.priority ?? 'medium')
  const [desireTier, setDesireTier]   = useState<DesireTier>(item?.desire_tier ?? 'want')
  const [notes, setNotes]             = useState(item?.notes ?? '')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  useEffect(() => {
    document.getElementById('purchase-title')?.focus()
  }, [])

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError('')

    const payload = {
      title:        title.trim(),
      url:          url.trim() || null,
      price:        price ? parseFloat(price) : null,
      target_price: targetPrice ? parseFloat(targetPrice) : null,
      status,
      priority,
      desire_tier:  desireTier,
      notes:        notes.trim() || null,
    }

    const { error: dbError } = item
      ? await supabase.from('purchase_items').update(payload).eq('id', item.id)
      : await supabase.from('purchase_items').insert({ ...payload, list_id: listId })

    setSaving(false)
    if (dbError) { setError(dbError.message); return }
    onSave()
  }

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title">

        <div className={styles.modalHeader}>
          <h2 id="modal-title" className={styles.modalTitle}>
            {item ? 'Edit item' : 'Add item'}
          </h2>
          <button onClick={onClose} aria-label="Close" className={styles.closeBtn}>
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div className={styles.modalBody}>
          <label className={styles.label} htmlFor="purchase-title">Item name</label>
          <input
            id="purchase-title"
            className={styles.input}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. RTX 5080"
          />

          <label className={styles.label} htmlFor="purchase-url">Link</label>
          <input
            id="purchase-url"
            className={styles.input}
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://…"
            type="url"
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className={styles.label} htmlFor="purchase-price">Price (SEK)</label>
              <input
                id="purchase-price"
                className={styles.input}
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="12 995"
                type="number"
                min="0"
              />
            </div>
            <div>
              <label className={styles.label} htmlFor="purchase-target">Target price (SEK)</label>
              <input
                id="purchase-target"
                className={styles.input}
                value={targetPrice}
                onChange={e => setTargetPrice(e.target.value)}
                placeholder="10 500"
                type="number"
                min="0"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className={styles.label} htmlFor="purchase-tier">Need / Want / Dream</label>
              <select
                id="purchase-tier"
                className={styles.select}
                value={desireTier}
                onChange={e => setDesireTier(e.target.value as DesireTier)}
              >
                <option value="need">Need</option>
                <option value="want">Want</option>
                <option value="dream">Dream</option>
              </select>
            </div>
            <div>
              <label className={styles.label} htmlFor="purchase-priority">Priority</label>
              <select
                id="purchase-priority"
                className={styles.select}
                value={priority}
                onChange={e => setPriority(e.target.value as PurchasePriority)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className={styles.label} htmlFor="purchase-status">Status</label>
              <select
                id="purchase-status"
                className={styles.select}
                value={status}
                onChange={e => setStatus(e.target.value as PurchaseStatus)}
              >
                <option value="considering">Considering</option>
                <option value="decided">Decided</option>
                <option value="bought">Bought</option>
              </select>
            </div>
          </div>

          <label className={styles.label} htmlFor="purchase-notes">Notes</label>
          <textarea
            id="purchase-notes"
            className={styles.textarea}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Pros, cons, observations…"
            rows={3}
          />

          {error && <p className={styles.error}>{error}</p>}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save item'}
          </button>
        </div>
      </div>
    </div>
  )
}
