'use client'

import { SupabaseClient } from '@supabase/supabase-js'
import { TripItem as TripItemType } from '../types'
import styles from './TripItem.module.css'

type Props = {
  item: TripItemType
  onEdit: () => void
  onStatusChange: (newStatus: string) => void
  onRefresh: () => void
  supabase: SupabaseClient
}

const TRAVEL_ICONS: Record<string, string> = {
  walk: 'ti-walk', bike: 'ti-bike', bus: 'ti-bus',
  train: 'ti-train', car: 'ti-car', ferry: 'ti-sailboat', flight: 'ti-plane',
}

const PRIORITY_DOT: Record<string, string> = {
  low: '#b0a89c', medium: '#c8900a', high: '#dc2626',
}

export default function TripItem({ item, onEdit, onStatusChange, onRefresh, supabase }: Props) {
  const handleDelete = async () => {
    if (!confirm(`Remove "${item.name}"?`)) return
    await supabase.from('trip_items').delete().eq('id', item.id)
    onRefresh()
  }

  const costs = (item.costs ?? []).map((c: unknown) => {
    const cost = c as Record<string, unknown>
    if (typeof cost.amount === 'number') {
      return { label: String(cost.label ?? ''), variants: [{ name: 'Standard', amount: cost.amount as number }] }
    }
    return { label: String(cost.label ?? ''), variants: Array.isArray(cost.variants) ? cost.variants as {name: string, amount: number}[] : [] }
  })

  // Get min and max across all variants of all cost entries
  const allAmounts = costs.flatMap(c => (c.variants ?? []).map(v => v.amount))
  const minCost = allAmounts.length > 0 ? Math.min(...allAmounts) : null
  const maxCost = allAmounts.length > 0 ? Math.max(...allAmounts) : null
  const costRange = minCost !== null && maxCost !== null
    ? minCost === maxCost
      ? `${minCost.toLocaleString('sv-SE')} SEK`
      : `${minCost.toLocaleString('sv-SE')}–${maxCost.toLocaleString('sv-SE')} SEK`
    : null

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('sv-SE')
  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })

  // Highlight planned date if within 30 days
  const isUpcoming = item.planned_date
    ? (new Date(item.planned_date).getTime() - Date.now()) / 86400000 <= 30
    : false

  return (
    <li className={`${styles.item} ${item.status === 'done' ? styles.itemDone : ''}`}>
      <div className={styles.main}>

        {/* Top row */}
        <div className={styles.topRow}>
          <span
            className={styles.priorityDot}
            style={{ background: PRIORITY_DOT[item.priority] }}
            title={`Priority: ${item.priority}`}
          />
          <span className={styles.name}>{item.name}</span>

          {/* Inline status dropdown */}
          <select
            className={`${styles.statusSelect} ${styles[item.status]}`}
            value={item.status}
            onChange={e => onStatusChange(e.target.value)}
            aria-label="Status"
          >
            <option value="considering">Considering</option>
            <option value="decided">Decided</option>
            <option value="done">Visited</option>
          </select>

          <div className={styles.actions}>
            <button onClick={onEdit} title="Edit" aria-label="Edit" className={styles.iconBtn}>
              <i className="ti ti-edit" aria-hidden="true" />
            </button>
            <button onClick={handleDelete} title="Delete" aria-label="Delete" className={`${styles.iconBtn} ${styles.iconBtnDanger}`}>
              <i className="ti ti-trash" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Planned date */}
        {item.planned_date && (
          <div className={`${styles.plannedDate} ${isUpcoming ? styles.plannedDateUpcoming : ''}`}>
            <i className="ti ti-calendar" aria-hidden="true" />
            Planned: {formatDate(item.planned_date)}
            {isUpcoming && <span className={styles.soonBadge}>Soon</span>}
          </div>
        )}

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
          {costRange && (
            <span className={styles.metaBadge}>
              <i className="ti ti-receipt" aria-hidden="true" />
              {costRange}
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
              Cost breakdown
            </summary>
            <div className={styles.costBreakdown}>
              {costs.map((c, i) => (
                <div key={i} className={styles.costEntry}>
                  <span className={styles.costEntryLabel}>{c.label}</span>
                  <div className={styles.costVariants}>
                    {(c.variants ?? []).map((v, j) => (
                      <div key={j} className={styles.costVariantRow}>
                        <span className={styles.variantName}>{v.name}</span>
                        <span className={styles.variantAmount}>{v.amount.toLocaleString('sv-SE')} SEK</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
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
