'use client'

// app/lists/components/EventSuggestionBanner.tsx
// Shows undismissed hub_events that have suggest_timeline=true.
// User picks which ones to add to their timeline, then dismisses the rest.

import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { HubEvent } from '../types'
import styles from './EventSuggestionBanner.module.css'

type Props = {
  events: HubEvent[]
  onDismiss: (ids: string[]) => void
}

const BRANCH_ICON: Record<string, string> = {
  inventory:  'ti-package',
  lists:      'ti-checkbox',
  pathfinder: 'ti-sword',
  game_night: 'ti-dice-5',
}

export default function EventSuggestionBanner({ events, onDismiss }: Props) {
  const supabase = createClientComponentClient()
  const [selected, setSelected] = useState<Set<string>>(new Set(events.map(e => e.id)))
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(true)

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const handleAddToTimeline = async () => {
    if (selected.size === 0) return
    setSaving(true)

    // Write selected events to timeline as entries
    // Adjust the table/column names to match your timeline branch schema
    const rows = events
      .filter(e => selected.has(e.id))
      .map(e => ({
        title:      e.title,
        date:       new Date(e.created_at).toISOString().split('T')[0],
        source:     e.source_branch,
        metadata:   e.metadata,
      }))

    const { error } = await supabase.from('timeline_events').insert(rows)

    if (error) {
      console.error('Failed to add timeline events:', error.message)
      // Still dismiss so the banner doesn't get stuck
    }

    // Dismiss all events (both selected and unselected)
    onDismiss(events.map(e => e.id))
    setSaving(false)
  }

  const handleDismissAll = () => onDismiss(events.map(e => e.id))

  if (!expanded) {
    return (
      <button className={styles.collapsed} onClick={() => setExpanded(true)}>
        <i className="ti ti-bell" aria-hidden="true" />
        {events.length} thing{events.length !== 1 ? 's' : ''} to log to timeline
      </button>
    )
  }

  return (
    <div className={styles.banner} role="region" aria-label="Timeline suggestions">
      <div className={styles.bannerHeader}>
        <div className={styles.bannerTitle}>
          <i className="ti ti-timeline" aria-hidden="true" />
          {events.length} thing{events.length !== 1 ? 's' : ''} happened — add to timeline?
        </div>
        <button
          className={styles.collapseBtn}
          onClick={() => setExpanded(false)}
          aria-label="Collapse suggestions"
        >
          <i className="ti ti-chevron-up" aria-hidden="true" />
        </button>
      </div>

      <ul className={styles.eventList} role="list">
        {events.map(e => (
          <li key={e.id} className={styles.eventItem}>
            <label className={styles.eventLabel}>
              <input
                type="checkbox"
                checked={selected.has(e.id)}
                onChange={() => toggle(e.id)}
                className={styles.checkbox}
              />
              <i
                className={`ti ${BRANCH_ICON[e.source_branch] ?? 'ti-point'} ${styles.branchIcon}`}
                aria-hidden="true"
              />
              <span className={styles.eventTitle}>{e.title}</span>
              <span className={styles.eventDate}>
                {new Date(e.created_at).toLocaleDateString('sv-SE')}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className={styles.bannerActions}>
        <button
          className={styles.addBtn}
          onClick={handleAddToTimeline}
          disabled={saving || selected.size === 0}
        >
          {saving
            ? <><i className="ti ti-loader-2" aria-hidden="true" /> Saving…</>
            : <>Add {selected.size} to timeline</>
          }
        </button>
        <button className={styles.dismissBtn} onClick={handleDismissAll}>
          Dismiss all
        </button>
      </div>
    </div>
  )
}
