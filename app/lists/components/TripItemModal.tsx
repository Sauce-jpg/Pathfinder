'use client'

// app/lists/components/TripItemModal.tsx

import { useState, useEffect } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import { TripItem, TripStatus, TripPriority, TRAVEL_OPTIONS, CostEntry } from '../types'
import styles from './Modal.module.css'
import tripStyles from './TripItemModal.module.css'

type Props = {
  item: TripItem | null
  listId: string
  onClose: () => void
  onSave: () => void
  supabase: SupabaseClient
}

export default function TripItemModal({ item, listId, onClose, onSave, supabase }: Props) {
  const [name, setName]               = useState(item?.name ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [location, setLocation]       = useState(item?.location ?? '')
  const [mapsUrl, setMapsUrl]         = useState(item?.maps_url ?? '')
  const [travelOptions, setTravelOptions] = useState<string[]>(item?.travel_options ?? [])
  const [whatToBring, setWhatToBring] = useState(item?.what_to_bring ?? '')
  const [costs, setCosts]             = useState<CostEntry[]>(item?.costs ?? [])
  const [duration, setDuration]       = useState(item?.duration ?? '')
  const [status, setStatus]           = useState<TripStatus>(item?.status ?? 'considering')
  const [priority, setPriority]       = useState<TripPriority>(item?.priority ?? 'medium')
  const [url, setUrl]                 = useState(item?.url ?? '')
  const [notes, setNotes]             = useState(item?.notes ?? '')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  useEffect(() => {
    document.getElementById('trip-name')?.focus()
  }, [])

  const toggleTravel = (opt: string) =>
    setTravelOptions(prev =>
      prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt]
    )

  const addCostRow = () =>
    setCosts(prev => [...prev, { label: '', amount: 0 }])

  const updateCost = (i: number, field: 'label' | 'amount', value: string) =>
    setCosts(prev => prev.map((c, idx) =>
      idx === i ? { ...c, [field]: field === 'amount' ? parseFloat(value) || 0 : value } : c
    ))

  const removeCost = (i: number) =>
    setCosts(prev => prev.filter((_, idx) => idx !== i))

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')

    const payload = {
      name:           name.trim(),
      description:    description.trim() || null,
      location:       location.trim() || null,
      maps_url:       mapsUrl.trim() || null,
      travel_options: travelOptions,
      what_to_bring:  whatToBring.trim() || null,
      costs:          costs.filter(c => c.label.trim()),
      duration:       duration.trim() || null,
      status,
      priority,
      url:            url.trim() || null,
      notes:          notes.trim() || null,
    }

    const { error: dbError } = item
      ? await supabase.from('trip_items').update(payload).eq('id', item.id)
      : await supabase.from('trip_items').insert({ ...payload, list_id: listId })

    setSaving(false)
    if (dbError) { setError(dbError.message); return }
    onSave()
  }

  const TRAVEL_LABELS: Record<string, string> = {
    walk: 'Walk', bike: 'Bike', bus: 'Bus',
    train: 'Train', car: 'Car', ferry: 'Ferry', flight: 'Flight',
  }

  const TRAVEL_ICONS: Record<string, string> = {
    walk: 'ti-walk', bike: 'ti-bike', bus: 'ti-bus',
    train: 'ti-train', car: 'ti-car', ferry: 'ti-sailboat', flight: 'ti-plane',
  }

  const totalCost = costs.reduce((sum, c) => sum + (c.amount || 0), 0)

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title">

        <div className={styles.modalHeader}>
          <h2 id="modal-title" className={styles.modalTitle}>
            {item ? 'Edit destination' : 'Add destination'}
          </h2>
          <button onClick={onClose} aria-label="Close" className={styles.closeBtn}>
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div className={styles.modalBody}>

          {/* Name */}
          <label className={styles.label} htmlFor="trip-name">Destination name</label>
          <input
            id="trip-name"
            className={styles.input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Gamla Stan, Stockholm"
          />

          {/* Location + Maps URL */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className={styles.label} htmlFor="trip-location">Location</label>
              <input
                id="trip-location"
                className={styles.input}
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="City, country"
              />
            </div>
            <div>
              <label className={styles.label} htmlFor="trip-maps">Google Maps URL</label>
              <input
                id="trip-maps"
                className={styles.input}
                value={mapsUrl}
                onChange={e => setMapsUrl(e.target.value)}
                placeholder="https://maps.google.com/..."
                type="url"
              />
            </div>
          </div>

          {/* Description */}
          <label className={styles.label} htmlFor="trip-desc">Description</label>
          <textarea
            id="trip-desc"
            className={styles.textarea}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What is this place? Why visit?"
            rows={3}
          />

          {/* Travel options */}
          <label className={styles.label}>How to get there</label>
          <div className={tripStyles.travelGrid}>
            {TRAVEL_OPTIONS.map(opt => (
              <button
                key={opt}
                type="button"
                className={`${tripStyles.travelBtn} ${travelOptions.includes(opt) ? tripStyles.travelBtnActive : ''}`}
                onClick={() => toggleTravel(opt)}
                aria-pressed={travelOptions.includes(opt)}
              >
                <i className={`ti ${TRAVEL_ICONS[opt]}`} aria-hidden="true" />
                {TRAVEL_LABELS[opt]}
              </button>
            ))}
          </div>

          {/* Duration + Status + Priority */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className={styles.label} htmlFor="trip-duration">Duration</label>
              <input
                id="trip-duration"
                className={styles.input}
                value={duration}
                onChange={e => setDuration(e.target.value)}
                placeholder="Half day, 3 days..."
              />
            </div>
            <div>
              <label className={styles.label} htmlFor="trip-status">Status</label>
              <select
                id="trip-status"
                className={styles.select}
                value={status}
                onChange={e => setStatus(e.target.value as TripStatus)}
              >
                <option value="considering">Considering</option>
                <option value="decided">Decided</option>
                <option value="done">Visited</option>
              </select>
            </div>
            <div>
              <label className={styles.label} htmlFor="trip-priority">Priority</label>
              <select
                id="trip-priority"
                className={styles.select}
                value={priority}
                onChange={e => setPriority(e.target.value as TripPriority)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          {/* Costs breakdown */}
          <div className={tripStyles.costsSection}>
            <div className={tripStyles.costsHeader}>
              <label className={styles.label}>Costs</label>
              {totalCost > 0 && (
                <span className={tripStyles.costTotal}>
                  {totalCost.toLocaleString('sv-SE')} SEK total
                </span>
              )}
              <button
                type="button"
                className={tripStyles.addCostBtn}
                onClick={addCostRow}
              >
                <i className="ti ti-plus" aria-hidden="true" />
                Add cost
              </button>
            </div>
            {costs.map((c, i) => (
              <div key={i} className={tripStyles.costRow}>
                <input
                  className={`${styles.input} ${tripStyles.costLabel}`}
                  value={c.label}
                  onChange={e => updateCost(i, 'label', e.target.value)}
                  placeholder="e.g. Entry fee, Food, Travel..."
                />
                <input
                  className={`${styles.input} ${tripStyles.costAmount}`}
                  value={c.amount || ''}
                  onChange={e => updateCost(i, 'amount', e.target.value)}
                  placeholder="0"
                  type="number"
                  min="0"
                />
                <span className={tripStyles.costCurrency}>SEK</span>
                <button
                  type="button"
                  className={tripStyles.removeCostBtn}
                  onClick={() => removeCost(i)}
                  aria-label="Remove cost"
                >
                  <i className="ti ti-x" aria-hidden="true" />
                </button>
              </div>
            ))}
            {costs.length === 0 && (
              <p className={tripStyles.costsEmpty}>No costs added yet.</p>
            )}
          </div>

          {/* Link */}
          <label className={styles.label} htmlFor="trip-url">Link</label>
          <input
            id="trip-url"
            className={styles.input}
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://..."
            type="url"
          />

          {/* What to bring */}
          <label className={styles.label} htmlFor="trip-bring">What to bring</label>
          <textarea
            id="trip-bring"
            className={styles.textarea}
            value={whatToBring}
            onChange={e => setWhatToBring(e.target.value)}
            placeholder="Sunscreen, water, hiking boots..."
            rows={2}
          />

          {/* Notes */}
          <label className={styles.label} htmlFor="trip-notes">Notes</label>
          <textarea
            id="trip-notes"
            className={styles.textarea}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Opening hours, booking needed, tips..."
            rows={2}
          />

          {/* Timestamps (edit mode only) */}
          {item && (
            <div className={tripStyles.timestamps}>
              <span>Created {new Date(item.created_at).toLocaleDateString('sv-SE')}</span>
              {item.updated_at !== item.created_at && (
                <span>· Last edited {new Date(item.updated_at).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })}</span>
              )}
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save destination'}
          </button>
        </div>
      </div>
    </div>
  )
}
