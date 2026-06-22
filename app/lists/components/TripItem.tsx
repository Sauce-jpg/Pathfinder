'use client'

// app/lists/components/TripItem.tsx

import { SupabaseClient } from '@supabase/supabase-js'
import { TripItem as TripItemType } from '../types'
import styles from './TripItem.module.css'

type Props = {
  item: TripItemType
  onEdit: () => void
  onStatusCycle: () => void
  onRefresh: () => void
  supabase: SupabaseClient
}

const TRAVEL_ICONS: Record<string, string> = {
  walk: 'ti-walk', bike: 'ti-bike', bus: 'ti-bus',
  train: 'ti-train', car: 'ti-car', ferry: 'ti-sailboat', flight: 'ti-plane',
}

const STATUS_CYCLE: Record<string, { next: string; label: string; cls: string; btnLabel: string; btnIcon: string }> = {
  considering: { next: 'decided',     label: 'Considering', cls: 'considering', btnLabel: 'Mark decided',  btnIcon: 'ti-thumb-up'   },
  decided:     { next: 'done',        label: 'Decided',     cls: 'decided',     btnLabel: 'Mark visited',  btnIcon: 'ti-check'      },
  done:        { next: 'considering', label: 'Visited',     cls: 'done',        btnLabel: 'Undo visited',  btnIcon: 'ti-rotate-ccw' },
}

const PRIORITY_DOT: Record<string, string> = {
  low: '#b0a89c', medium: '#c8900a', high: '#dc2626',
}

export default function TripItem({ item, onEdit, onStatusCycle, onRefresh, supabase }: Props) {
  const handleDelete = async () => {
    if (!confirm(`Remove "${item.name}"?`)) return
    await supabase.from('trip_items').delete().eq('id', item.id)
    onRefresh()
  }

  const cfg = STATUS_CYCLE[item.status]

  // Total cost across all cost entries
  const costs = item.costs ?? []
  const totalCost = costs.reduce((sum, c) => sum + (c.amount ?? 0), 0)

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('sv-SE')

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })

  return (
    <li className={`${styles.item} ${item.status === 'done' ? styles.done : ''}`}>
      <div className={styles.main}>

        {/* Top row */}
        <div className={styles.topRow}>
          <span
            className={styles.priorityDot}
            style={{ background: PRIORITY_DOT[item.priority] }}
            title={`Priority: ${item.priority}`}
          />
          <span className={styles.name}>{item.name}</span>
          <span className={`${styles.statusBadge} ${styles[cfg.cls]}`}>{cfg.label}</span>

          <div className={styles.actions}>
            <button
              className={`${styles.cycleBtn} ${item.status === 'done' ? styles.cycleBtnUndo : ''}`}
              onClick={onStatusCycle}
              title={cfg.btnLabel}
              aria-label={cfg.btnLabel}
            >
              <i className={`ti ${cfg.btnIcon}`} aria-hidden="true" />
              {cfg.btnLabel}
            </button>
            <button onClick={onEdit} title="Edit" aria-label="Edit" className={styles.iconBtn}>
              <i className="ti ti-edit" aria-hidden="true" />
            </button>
            <button onClick={handleDelete} title="Delete" aria-label="Delete" className={`${styles.iconBtn} ${styles.iconBtnDanger}`}>
              <i className="ti ti-trash" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Visited date */}
        {item.status === 'done' && item.visited_at && (
          <div className={styles.visitedDate}>
            <i className="ti ti-calendar-check" aria-hidden="true" />
            Visited {formatDate(item.visited_at)}
          </div>
        )}

        {/* Location */}
        {item.location && (
          <div className={styles.locationRow}>
            <i className="ti ti-map-pin" aria-hidden="true" />
            {item.maps_url ? (
              <a href={item.maps_url} target="_blank" rel="noopener noreferrer" className={styles.locationLink}>
                {item.location}
              </a>
            ) : (
              <span>{item.location}</span>
            )}
          </div>
        )}

        {/* Description */}
        {item.description && (
          <p className={styles.description}>{item.description}</p>
        )}

        {/* Meta row */}
        <div className={styles.metaRow}>
          {item.travel_options.length > 0 && (
            <div className={styles.travelOptions}>
              {item.travel_options.map(opt => (
                <span key={opt} className={styles.travelPill} title={opt}>
                  <i className={`ti ${TRAVEL_ICONS[opt] ?? 'ti-map-pin'}`} aria-hidden="true" />
                  {opt}
                </span>
              ))}
            </div>
          )}

          {item.duration && (
            <span className={styles.metaBadge}>
              <i className="ti ti-clock" aria-hidden="true" />
              {item.duration}
            </span>
          )}

          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.metaLink}>
              <i className="ti ti-external-link" aria-hidden="true" />
              Link
            </a>
          )}
        </div>

        {/* Costs breakdown */}
        {costs.length > 0 && (
          <details className={styles.details}>
            <summary className={styles.detailsSummary}>
              <i className="ti ti-receipt" aria-hidden="true" />
              Costs
              <span className={styles.costTotal}>
                {totalCost.toLocaleString('sv-SE')} SEK total
              </span>
            </summary>
            <ul className={styles.costList}>
              {costs.map((c, i) => (
                <li key={i} className={styles.costRow}>
                  <span className={styles.costLabel}>{c.label}</span>
                  <span className={styles.costAmount}>{c.amount.toLocaleString('sv-SE')} SEK</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        {/* What to bring */}
        {item.what_to_bring && (
          <details className={styles.details}>
            <summary className={styles.detailsSummary}>
              <i className="ti ti-backpack" aria-hidden="true" />
              What to bring
            </summary>
            <p className={styles.detailsBody}>{item.what_to_bring}</p>
          </details>
        )}

        {/* Notes */}
        {item.notes && (
          <details className={styles.details}>
            <summary className={styles.detailsSummary}>
              <i className="ti ti-notes" aria-hidden="true" />
              Notes
            </summary>
            <p className={styles.detailsBody}>{item.notes}</p>
          </details>
        )}

        {/* Timestamps */}
        <div className={styles.timestamps}>
          <span>Created {formatDate(item.created_at)}</span>
          {item.updated_at !== item.created_at && (
            <span>· Edited {formatDateTime(item.updated_at)}</span>
          )}
        </div>
      </div>
    </li>
  )
}
