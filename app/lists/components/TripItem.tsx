'use client'

// app/lists/components/TripItem.tsx

import { SupabaseClient } from '@supabase/supabase-js'
import { TripItem as TripItemType } from '../types'
import styles from './TripItem.module.css'

type Props = {
  item: TripItemType
  onEdit: () => void
  onMarkDone: () => void
  onRefresh: () => void
  supabase: SupabaseClient
}

const TRAVEL_ICONS: Record<string, string> = {
  walk:   'ti-walk',
  bike:   'ti-bike',
  bus:    'ti-bus',
  train:  'ti-train',
  car:    'ti-car',
  ferry:  'ti-sailboat',
  flight: 'ti-plane',
}

const STATUS_CONFIG = {
  considering: { label: 'Considering', cls: 'considering' },
  decided:     { label: 'Decided',     cls: 'decided'     },
  done:        { label: 'Visited',     cls: 'done'        },
}

const PRIORITY_DOT: Record<string, string> = {
  low:    '#b0a89c',
  medium: '#c8900a',
  high:   '#dc2626',
}

export default function TripItem({ item, onEdit, onMarkDone, onRefresh, supabase }: Props) {
  const handleDelete = async () => {
    if (!confirm(`Remove "${item.name}"?`)) return
    await supabase.from('trip_items').delete().eq('id', item.id)
    onRefresh()
  }

  const cfg = STATUS_CONFIG[item.status]

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
            {item.status !== 'done' && (
              <button
                className={styles.doneBtn}
                onClick={onMarkDone}
                title="Mark as visited"
                aria-label="Mark as visited"
              >
                <i className="ti ti-check" aria-hidden="true" />
              </button>
            )}
            <button onClick={onEdit} title="Edit" aria-label="Edit destination" className={styles.iconBtn}>
              <i className="ti ti-edit" aria-hidden="true" />
            </button>
            <button onClick={handleDelete} title="Delete" aria-label="Delete destination" className={`${styles.iconBtn} ${styles.iconBtnDanger}`}>
              <i className="ti ti-trash" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Location row */}
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

          {item.cost_estimate != null && (
            <span className={styles.metaBadge}>
              <i className="ti ti-currency-krona" aria-hidden="true" />
              {item.cost_estimate.toLocaleString('sv-SE')} SEK
            </span>
          )}

          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.metaLink}>
              <i className="ti ti-external-link" aria-hidden="true" />
              Link
            </a>
          )}
        </div>

        {/* Expandable details */}
        {item.what_to_bring && (
          <details className={styles.details}>
            <summary className={styles.detailsSummary}>
              <i className="ti ti-backpack" aria-hidden="true" />
              What to bring
            </summary>
            <p className={styles.detailsBody}>{item.what_to_bring}</p>
          </details>
        )}

        {item.notes && (
          <details className={styles.details}>
            <summary className={styles.detailsSummary}>
              <i className="ti ti-notes" aria-hidden="true" />
              Notes
            </summary>
            <p className={styles.detailsBody}>{item.notes}</p>
          </details>
        )}
      </div>
    </li>
  )
}
