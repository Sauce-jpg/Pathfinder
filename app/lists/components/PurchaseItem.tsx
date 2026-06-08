'use client'

// app/lists/components/PurchaseItem.tsx

import { SupabaseClient } from '@supabase/supabase-js'
import { PurchaseItem as PurchaseItemType } from '../types'
import styles from './PurchaseItem.module.css'

type Props = {
  item: PurchaseItemType
  inCompare: boolean
  onToggleCompare: () => void
  onEdit: () => void
  onMarkBought: () => void
  onRefresh: () => void
  supabase: SupabaseClient
}

const TIER_CONFIG = {
  need:  { label: 'Need',  cls: 'need'  },
  want:  { label: 'Want',  cls: 'want'  },
  dream: { label: 'Dream', cls: 'dream' },
}

const STATUS_ICON = {
  considering: 'ti-clock',
  decided:     'ti-thumb-up',
  bought:      'ti-check',
}

const PRIORITY_DOT = {
  low:    '#9ca3af',
  medium: '#f59e0b',
  high:   '#ef4444',
}

export default function PurchaseItem({
  item, inCompare, onToggleCompare, onEdit, onMarkBought, onRefresh, supabase
}: Props) {
  const handleDelete = async () => {
    if (!confirm(`Remove "${item.title}"?`)) return
    await supabase.from('purchase_items').delete().eq('id', item.id)
    onRefresh()
  }

  const atTarget = item.target_price && item.price && item.price <= item.target_price

  return (
    <li className={`${styles.item} ${item.status === 'bought' ? styles.bought : ''}`}>
      {/* Compare toggle */}
      <button
        className={`${styles.compareToggle} ${inCompare ? styles.compareActive : ''}`}
        onClick={onToggleCompare}
        aria-label={inCompare ? 'Remove from comparison' : 'Add to comparison'}
        title="Compare"
      >
        <i className="ti ti-columns" aria-hidden="true" />
      </button>

      {/* Main content */}
      <div className={styles.main}>
        <div className={styles.titleRow}>
          {/* Priority dot */}
          <span
            className={styles.priorityDot}
            style={{ background: PRIORITY_DOT[item.priority] }}
            title={`Priority: ${item.priority}`}
          />

          <span className={styles.title}>{item.title}</span>

          <span className={`${styles.tierBadge} ${styles[TIER_CONFIG[item.desire_tier].cls]}`}>
            {TIER_CONFIG[item.desire_tier].label}
          </span>

          <span className={`${styles.statusIcon} ${item.status === 'bought' ? styles.statusBought : ''}`}>
            <i className={`ti ${STATUS_ICON[item.status]}`} aria-hidden="true" />
          </span>
        </div>

        <div className={styles.meta}>
          {item.price != null && (
            <span className={`${styles.price} ${atTarget ? styles.atTarget : ''}`}>
              {item.price.toLocaleString('sv-SE')} SEK
              {atTarget && <i className="ti ti-target" aria-hidden="true" title="At or below target price" />}
            </span>
          )}
          {item.target_price != null && item.status !== 'bought' && (
            <span className={styles.targetPrice}>
              target: {item.target_price.toLocaleString('sv-SE')} SEK
            </span>
          )}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
              aria-label={`Visit link for ${item.title}`}
            >
              <i className="ti ti-external-link" aria-hidden="true" />
            </a>
          )}
        </div>

        {item.notes && (
          <p className={styles.notes}>{item.notes}</p>
        )}
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        {item.status !== 'bought' && (
          <button
            className={styles.buyBtn}
            onClick={onMarkBought}
            aria-label="Mark as bought"
            title="Mark as bought"
          >
            <i className="ti ti-shopping-cart" aria-hidden="true" />
          </button>
        )}
        <button onClick={onEdit} aria-label="Edit item" className={styles.iconBtn}>
          <i className="ti ti-edit" aria-hidden="true" />
        </button>
        <button onClick={handleDelete} aria-label="Delete item" className={styles.iconBtn}>
          <i className="ti ti-trash" aria-hidden="true" />
        </button>
      </div>
    </li>
  )
}
